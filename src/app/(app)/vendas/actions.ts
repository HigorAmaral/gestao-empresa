"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { dateVal, intOrNull, num, str, toFormError, ValidationError, type FormState } from "@/lib/form";
import { parseItems, round2 } from "@/lib/items";
import { INSTANT_PAYMENTS } from "@/lib/format";

function back(id: number, key: "ok" | "erro", msg: string): never {
  redirect(`/vendas/${id}?${key}=${encodeURIComponent(msg)}`);
}

function revalidateAll() {
  revalidateTag("sidebar-alerts", "max");
  for (const p of ["/vendas", "/produtos", "/estoque", "/financeiro", "/"]) revalidatePath(p);
}

/** Cria ou edita uma venda (somente enquanto estiver como orçamento). */
export async function saveSale(id: number | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireUser();
  let saleId = id;
  try {
    const items = parseItems(fd);
    const discount = Math.max(0, num(fd, "discount"));
    const subtotal = round2(items.reduce((s, i) => s + i.quantity * i.price, 0));
    if (discount > subtotal) throw new ValidationError("O desconto não pode ser maior que o subtotal.");

    const products = await prisma.product.count({ where: { id: { in: items.map((i) => i.productId) } } });
    if (products !== items.length) throw new ValidationError("Um ou mais produtos não existem mais.");

    const installments = Math.min(12, Math.max(1, Math.floor(num(fd, "installments", 1))));

    const data = {
      clientId: intOrNull(fd, "clientId"),
      date: dateVal(fd, "date") ?? new Date(),
      paymentMethod: str(fd, "paymentMethod"),
      installments,
      notes: str(fd, "notes"),
      subtotal,
      discount,
      total: round2(subtotal - discount),
    };
    const itemRows = items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: i.price,
      total: round2(i.quantity * i.price),
    }));

    if (id) {
      const sale = await prisma.sale.findUnique({ where: { id } });
      if (!sale) throw new ValidationError("Venda não encontrada.");
      if (sale.status !== "ORCAMENTO") throw new ValidationError("Apenas orçamentos podem ser editados.");
      await prisma.$transaction([
        prisma.saleItem.deleteMany({ where: { saleId: id } }),
        prisma.sale.update({ where: { id }, data: { ...data, items: { create: itemRows } } }),
      ]);
      await logAudit(session, "VENDAS", "EDITAR", `Editou orçamento de venda #${id} (R$ ${data.total.toFixed(2)})`, id);
    } else {
      const sale = await prisma.sale.create({ data: { ...data, userId: session.userId, items: { create: itemRows } } });
      saleId = sale.id;
      await logAudit(session, "VENDAS", "CRIAR", `Criou orçamento de venda #${saleId} (R$ ${data.total.toFixed(2)})`, saleId);
    }
  } catch (e) {
    return toFormError(e);
  }
  revalidateAll();
  back(saleId!, "ok", "Venda salva. Confirme para baixar o estoque e lançar no financeiro.");
}

/** Confirma a venda: baixa o estoque e gera a(s) conta(s) a receber (à vista ou parcelado). */
export async function confirmSale(id: number) {
  const session = await requireUser();
  try {
    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id }, include: { items: { include: { product: true } } } });
      if (!sale) throw new ValidationError("Venda não encontrada.");
      if (sale.status !== "ORCAMENTO") throw new ValidationError("Esta venda não está como orçamento.");
      if (sale.items.length === 0) throw new ValidationError("A venda não possui itens.");

      for (const item of sale.items) {
        if (item.product.stock < item.quantity)
          throw new ValidationError(
            `Estoque insuficiente para "${item.product.name}" (disponível: ${item.product.stock}, necessário: ${item.quantity}).`,
          );
      }
      for (const item of sale.items) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "SAIDA",
            quantity: item.quantity,
            reason: `Venda #${sale.id}`,
            userId: session.userId,
          },
        });
      }

      const installments = Math.min(12, Math.max(1, sale.installments || 1));
      const paidNow = installments === 1 && !!sale.paymentMethod && INSTANT_PAYMENTS.includes(sale.paymentMethod);

      if (installments === 1) {
        await tx.financialEntry.create({
          data: {
            type: "RECEITA",
            description: `Venda #${sale.id}`,
            category: "Vendas",
            amount: sale.total,
            dueDate: sale.date,
            status: paidNow ? "PAGO" : "PENDENTE",
            paidAt: paidNow ? new Date() : null,
            saleId: sale.id,
          },
        });
      } else {
        const baseSlice = round2(Math.floor((sale.total / installments) * 100) / 100);
        const remainder = round2(sale.total - baseSlice * installments);

        const rows = Array.from({ length: installments }, (_, i) => {
          const d = new Date(sale.date);
          d.setUTCMonth(d.getUTCMonth() + i);
          const amount = i === 0 ? round2(baseSlice + remainder) : baseSlice;
          return {
            type: "RECEITA",
            description: `Venda #${sale.id} (${i + 1}/${installments})`,
            category: "Vendas",
            amount,
            dueDate: d,
            status: "PENDENTE",
            paidAt: null,
            saleId: sale.id,
          };
        });
        await tx.financialEntry.createMany({ data: rows });
      }

      await tx.sale.update({ where: { id }, data: { status: "CONFIRMADA" } });
    });
    await logAudit(session, "VENDAS", "CONFIRMAR", `Confirmou venda #${id}`, id);
  } catch (e) {
    const r = toFormError(e);
    back(id, "erro", r?.error ?? "Erro ao confirmar.");
  }
  revalidateAll();
  back(id, "ok", "Venda confirmada! Estoque baixado e lançamento(s) financeiro(s) gerado(s).");
}

/** Cancela a venda: devolve o estoque (se confirmada) e cancela lançamentos pendentes. */
export async function cancelSale(id: number) {
  const session = await requireUser();
  try {
    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id }, include: { items: true } });
      if (!sale) throw new ValidationError("Venda não encontrada.");
      if (sale.status === "CANCELADA") throw new ValidationError("A venda já está cancelada.");

      if (sale.status === "CONFIRMADA") {
        for (const item of sale.items) {
          await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: "ENTRADA",
              quantity: item.quantity,
              reason: `Cancelamento da venda #${sale.id}`,
              userId: session.userId,
            },
          });
        }
        await tx.financialEntry.updateMany({ where: { saleId: id }, data: { status: "CANCELADO" } });
      }
      await tx.sale.update({ where: { id }, data: { status: "CANCELADA" } });
    });
    await logAudit(session, "VENDAS", "CANCELAR", `Cancelou venda #${id}`, id);
  } catch (e) {
    const r = toFormError(e);
    back(id, "erro", r?.error ?? "Erro ao cancelar.");
  }
  revalidateAll();
  back(id, "ok", "Venda cancelada.");
}

export async function deleteSale(id: number) {
  const session = await requireUser();
  const sale = await prisma.sale.findUnique({ where: { id } });
  if (!sale) redirect("/vendas");
  if (sale.status === "CONFIRMADA") back(id, "erro", "Cancele a venda antes de excluí-la.");
  await prisma.sale.delete({ where: { id } });
  await logAudit(session, "VENDAS", "EXCLUIR", `Excluiu venda #${id}`, id);
  revalidateAll();
  redirect("/vendas?ok=" + encodeURIComponent(`Venda #${id} excluída.`));
}

/** Duplica uma venda existente como um novo orçamento com os mesmos itens e cliente. */
export async function duplicateSale(id: number) {
  const session = await requireUser();
  const orig = await prisma.sale.findUnique({ where: { id }, include: { items: true } });
  if (!orig) redirect("/vendas");

  const copy = await prisma.sale.create({
    data: {
      clientId: orig.clientId,
      userId: session.userId,
      date: new Date(),
      status: "ORCAMENTO",
      paymentMethod: orig.paymentMethod,
      installments: orig.installments,
      subtotal: orig.subtotal,
      discount: orig.discount,
      total: orig.total,
      notes: orig.notes ? `${orig.notes} (Cópia da Venda #${orig.id})` : `Cópia da Venda #${orig.id}`,
      items: {
        create: orig.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          total: i.total,
        })),
      },
    },
  });

  await logAudit(session, "VENDAS", "CRIAR", `Duplicou a venda #${id} para o novo orçamento #${copy.id}`, copy.id);
  revalidateAll();
  redirect(`/vendas/${copy.id}?ok=` + encodeURIComponent(`Pedido #${id} duplicado como novo Orçamento #${copy.id}.`));
}
