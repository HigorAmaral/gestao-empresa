"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { dateVal, intOrNull, num, reqStr, str, toFormError, ValidationError, type FormState } from "@/lib/form";
import { parseItems, round2 } from "@/lib/items";
import { INSTANT_PAYMENTS } from "@/lib/format";

function back(id: number, key: "ok" | "erro", msg: string): never {
  redirect(`/os/${id}?${key}=${encodeURIComponent(msg)}`);
}

function revalidateAll() {
  for (const p of ["/os", "/produtos", "/estoque", "/financeiro", "/"]) revalidatePath(p);
}

/** Cria ou edita uma Ordem de Serviço (enquanto não concluída/cancelada). */
export async function saveServiceOrder(id: number | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireUser();
  let osId = id;
  try {
    const equipment = reqStr(fd, "equipment", "Equipamento / Item");
    const reportedIssue = reqStr(fd, "reportedIssue", "Defeito / Solicitação relatada");
    const items = parseItems(fd, true);
    const laborCost = Math.max(0, num(fd, "laborCost"));
    const discount = Math.max(0, num(fd, "discount"));
    const partsSubtotal = round2(items.reduce((s, i) => s + i.quantity * i.price, 0));
    const gross = round2(partsSubtotal + laborCost);
    if (discount > gross) throw new ValidationError("O desconto não pode ser maior que o valor bruto da OS.");

    const statusInput = str(fd, "status") ?? "ABERTA";
    const allowedEditStatuses = ["ABERTA", "EM_ANDAMENTO", "AGUARDANDO_PECA"];
    const status = allowedEditStatuses.includes(statusInput) ? statusInput : "ABERTA";
    const priorityInput = str(fd, "priority") ?? "NORMAL";
    const priority = ["BAIXA", "NORMAL", "ALTA", "URGENTE"].includes(priorityInput) ? priorityInput : "NORMAL";

    const data = {
      clientId: intOrNull(fd, "clientId"),
      technicianId: intOrNull(fd, "technicianId"),
      equipment,
      serialNumber: str(fd, "serialNumber"),
      reportedIssue,
      diagnosis: str(fd, "diagnosis"),
      priority,
      status,
      paymentMethod: str(fd, "paymentMethod"),
      openedAt: dateVal(fd, "openedAt") ?? new Date(),
      expectedDate: dateVal(fd, "expectedDate"),
      laborCost,
      partsSubtotal,
      discount,
      total: round2(gross - discount),
      notes: str(fd, "notes"),
    };

    const itemRows = items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: i.price,
      total: round2(i.quantity * i.price),
    }));

    if (id) {
      const existing = await prisma.serviceOrder.findUnique({ where: { id } });
      if (!existing) throw new ValidationError("Ordem de Serviço não encontrada.");
      if (existing.status === "CONCLUIDA" || existing.status === "CANCELADA") {
        throw new ValidationError("OS concluída ou cancelada não pode ser editada.");
      }
      await prisma.$transaction([
        prisma.serviceOrderItem.deleteMany({ where: { serviceOrderId: id } }),
        prisma.serviceOrder.update({ where: { id }, data: { ...data, items: { create: itemRows } } }),
      ]);
      await logAudit(session, "OS", "EDITAR", `Editou OS #${id} (${equipment})`, id);
    } else {
      const created = await prisma.serviceOrder.create({
        data: { ...data, userId: session.userId, items: { create: itemRows } },
      });
      osId = created.id;
      await logAudit(session, "OS", "CRIAR", `Abriu OS #${osId} (${equipment})`, osId);
    }
  } catch (e) {
    return toFormError(e);
  }
  revalidateAll();
  back(osId!, "ok", "Ordem de Serviço salva com sucesso.");
}

/** Conclui a OS: baixa peças do estoque e gera lançamento financeiro. */
export async function completeServiceOrder(id: number) {
  const session = await requireUser();
  try {
    await prisma.$transaction(async (tx) => {
      const os = await tx.serviceOrder.findUnique({
        where: { id },
        include: { items: { include: { product: true } } },
      });
      if (!os) throw new ValidationError("Ordem de Serviço não encontrada.");
      if (os.status === "CONCLUIDA" || os.status === "CANCELADA") {
        throw new ValidationError("Esta OS já foi finalizada ou cancelada.");
      }

      for (const item of os.items) {
        if (item.product.stock < item.quantity) {
          throw new ValidationError(
            `Estoque insuficiente para a peça "${item.product.name}" (disponível: ${item.product.stock}, necessário: ${item.quantity}).`,
          );
        }
      }

      for (const item of os.items) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "SAIDA",
            quantity: item.quantity,
            reason: `OS #${os.id} (${os.equipment})`,
            userId: session.userId,
          },
        });
      }

      if (os.total > 0) {
        const paidNow = !!os.paymentMethod && INSTANT_PAYMENTS.includes(os.paymentMethod);
        await tx.financialEntry.create({
          data: {
            type: "RECEITA",
            description: `OS #${os.id} — ${os.equipment}`,
            category: "Serviços",
            amount: os.total,
            dueDate: new Date(),
            status: paidNow ? "PAGO" : "PENDENTE",
            paidAt: paidNow ? new Date() : null,
            serviceOrderId: os.id,
          },
        });
      }

      await tx.serviceOrder.update({
        where: { id },
        data: { status: "CONCLUIDA", completedAt: new Date() },
      });
    });
    await logAudit(session, "OS", "CONFIRMAR", `Concluiu OS #${id}`, id);
  } catch (e) {
    const r = toFormError(e);
    back(id, "erro", r?.error ?? "Erro ao concluir OS.");
  }
  revalidateAll();
  back(id, "ok", "OS concluída! Peças baixadas do estoque e receita lançada no financeiro.");
}

/** Cancela a OS: se estava concluída, estorna peças ao estoque e cancela financeiro. */
export async function cancelServiceOrder(id: number) {
  const session = await requireUser();
  try {
    await prisma.$transaction(async (tx) => {
      const os = await tx.serviceOrder.findUnique({ where: { id }, include: { items: true } });
      if (!os) throw new ValidationError("Ordem de Serviço não encontrada.");
      if (os.status === "CANCELADA") throw new ValidationError("Esta OS já está cancelada.");

      if (os.status === "CONCLUIDA") {
        for (const item of os.items) {
          await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: "ENTRADA",
              quantity: item.quantity,
              reason: `Cancelamento da OS #${os.id}`,
              userId: session.userId,
            },
          });
        }
        await tx.financialEntry.updateMany({
          where: { serviceOrderId: id },
          data: { status: "CANCELADO" },
        });
      }
      await tx.serviceOrder.update({ where: { id }, data: { status: "CANCELADA" } });
    });
    await logAudit(session, "OS", "CANCELAR", `Cancelou OS #${id}`, id);
  } catch (e) {
    const r = toFormError(e);
    back(id, "erro", r?.error ?? "Erro ao cancelar OS.");
  }
  revalidateAll();
  back(id, "ok", "Ordem de Serviço cancelada.");
}

export async function deleteServiceOrder(id: number) {
  const session = await requireUser();
  const os = await prisma.serviceOrder.findUnique({ where: { id } });
  if (!os) redirect("/os");
  if (os.status === "CONCLUIDA") back(id, "erro", "Cancele a OS antes de excluí-la.");
  await prisma.serviceOrder.delete({ where: { id } });
  await logAudit(session, "OS", "EXCLUIR", `Excluiu OS #${id} (${os.equipment})`, id);
  revalidateAll();
  redirect("/os?ok=" + encodeURIComponent(`OS #${id} excluída.`));
}
