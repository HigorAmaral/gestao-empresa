"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { dateVal, intOrNull, str, toFormError, ValidationError, type FormState } from "@/lib/form";
import { parseItems, round2 } from "@/lib/items";

function back(id: number, key: "ok" | "erro", msg: string): never {
  redirect(`/compras/${id}?${key}=${encodeURIComponent(msg)}`);
}

function revalidateAll() {
  for (const p of ["/compras", "/produtos", "/estoque", "/financeiro", "/"]) revalidatePath(p);
}

/** Cria/edita um pedido de compra pendente e mantém a conta a pagar vinculada. */
export async function savePurchase(id: number | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireUser();
  let purchaseId = id;
  try {
    const items = parseItems(fd);
    const supplierId = intOrNull(fd, "supplierId");
    if (!supplierId) throw new ValidationError("Selecione o fornecedor.");
    const date = dateVal(fd, "date") ?? new Date();
    const dueDate = dateVal(fd, "dueDate") ?? date;
    const total = round2(items.reduce((s, i) => s + i.quantity * i.price, 0));
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new ValidationError("Fornecedor não encontrado.");

    const data = { supplierId, date, dueDate, total, notes: str(fd, "notes") };
    const itemRows = items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      unitCost: i.price,
      total: round2(i.quantity * i.price),
    }));

    await prisma.$transaction(async (tx) => {
      if (id) {
        const purchase = await tx.purchase.findUnique({ where: { id } });
        if (!purchase) throw new ValidationError("Compra não encontrada.");
        if (purchase.status !== "PENDENTE") throw new ValidationError("Apenas compras pendentes podem ser editadas.");
        await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
        await tx.purchase.update({ where: { id }, data: { ...data, items: { create: itemRows } } });
      } else {
        const p = await tx.purchase.create({ data: { ...data, userId: session.userId, items: { create: itemRows } } });
        purchaseId = p.id;
      }

      // Conta a pagar vinculada (atualiza se ainda estiver pendente)
      const entry = await tx.financialEntry.findFirst({ where: { purchaseId: purchaseId!, status: { not: "CANCELADO" } } });
      const finData = {
        type: "DESPESA",
        description: `Compra #${purchaseId} — ${supplier.name}`,
        category: "Compras",
        amount: total,
        dueDate,
        purchaseId: purchaseId!,
      };
      if (!entry) await tx.financialEntry.create({ data: finData });
      else if (entry.status === "PENDENTE") await tx.financialEntry.update({ where: { id: entry.id }, data: finData });
    });
  } catch (e) {
    return toFormError(e);
  }
  revalidateAll();
  back(purchaseId!, "ok", "Compra salva e conta a pagar lançada. Ao receber a mercadoria, clique em \"Receber\".");
}

/** Recebe a mercadoria: soma ao estoque e atualiza o preço de custo dos produtos. */
export async function receivePurchase(id: number) {
  const session = await requireUser();
  try {
    await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({ where: { id }, include: { items: true } });
      if (!purchase) throw new ValidationError("Compra não encontrada.");
      if (purchase.status !== "PENDENTE") throw new ValidationError("Esta compra não está pendente.");
      for (const item of purchase.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity }, costPrice: item.unitCost },
        });
        await tx.stockMovement.create({
          data: { productId: item.productId, type: "ENTRADA", quantity: item.quantity, reason: `Compra #${id}`, userId: session.userId },
        });
      }
      await tx.purchase.update({ where: { id }, data: { status: "RECEBIDA", receivedAt: new Date() } });
    });
  } catch (e) {
    const r = toFormError(e);
    back(id, "erro", r?.error ?? "Erro ao receber.");
  }
  revalidateAll();
  back(id, "ok", "Mercadoria recebida! Estoque e custos atualizados.");
}

export async function cancelPurchase(id: number) {
  const session = await requireUser();
  try {
    await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({ where: { id }, include: { items: { include: { product: true } } } });
      if (!purchase) throw new ValidationError("Compra não encontrada.");
      if (purchase.status === "CANCELADA") throw new ValidationError("A compra já está cancelada.");
      if (purchase.status === "RECEBIDA") {
        for (const item of purchase.items) {
          if (item.product.stock < item.quantity)
            throw new ValidationError(`Não é possível estornar: "${item.product.name}" tem apenas ${item.product.stock} em estoque.`);
        }
        for (const item of purchase.items) {
          await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: "SAIDA",
              quantity: item.quantity,
              reason: `Cancelamento da compra #${id}`,
              userId: session.userId,
            },
          });
        }
      }
      await tx.financialEntry.updateMany({ where: { purchaseId: id, status: "PENDENTE" }, data: { status: "CANCELADO" } });
      await tx.purchase.update({ where: { id }, data: { status: "CANCELADA" } });
    });
  } catch (e) {
    const r = toFormError(e);
    back(id, "erro", r?.error ?? "Erro ao cancelar.");
  }
  revalidateAll();
  back(id, "ok", "Compra cancelada.");
}

export async function deletePurchase(id: number) {
  await requireUser();
  const purchase = await prisma.purchase.findUnique({ where: { id } });
  if (!purchase) redirect("/compras");
  if (purchase.status === "RECEBIDA") back(id, "erro", "Cancele a compra antes de excluí-la.");
  await prisma.$transaction([
    prisma.financialEntry.deleteMany({ where: { purchaseId: id, status: { not: "PAGO" } } }),
    prisma.purchase.delete({ where: { id } }),
  ]);
  revalidateAll();
  redirect("/compras?ok=" + encodeURIComponent(`Compra #${id} excluída.`));
}
