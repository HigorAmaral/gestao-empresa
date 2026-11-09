"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { dateVal, num, reqStr, str, toFormError, ValidationError, type FormState } from "@/lib/form";

function revalidateAll() {
  for (const p of ["/financeiro", "/", "/relatorios"]) revalidatePath(p);
}

export async function saveEntry(id: number | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireAdmin();
  try {
    const type = str(fd, "type");
    if (type !== "RECEITA" && type !== "DESPESA") throw new ValidationError("Tipo inválido.");
    const amount = num(fd, "amount");
    if (amount <= 0) throw new ValidationError("O valor deve ser maior que zero.");
    const dueDate = dateVal(fd, "dueDate");
    if (!dueDate) throw new ValidationError("Informe o vencimento.");
    const status = str(fd, "status") ?? "PENDENTE";
    if (!["PENDENTE", "PAGO", "CANCELADO"].includes(status)) throw new ValidationError("Status inválido.");
    const paidAt = status === "PAGO" ? (dateVal(fd, "paidAt") ?? new Date()) : null;

    const data = {
      type,
      description: reqStr(fd, "description", "Descrição"),
      category: str(fd, "category"),
      amount,
      dueDate,
      status,
      paidAt,
      notes: str(fd, "notes"),
    };

    const repeat = Math.min(60, Math.max(1, Math.floor(num(fd, "repeat", 1))));
    if (id) {
      await prisma.financialEntry.update({ where: { id }, data });
      await logAudit(session, "FINANCEIRO", "EDITAR", `Editou lançamento #${id} (${data.description})`, id);
    } else if (repeat > 1) {
      const rows = Array.from({ length: repeat }, (_, i) => {
        const d = new Date(dueDate);
        d.setUTCMonth(d.getUTCMonth() + i);
        return {
          ...data,
          description: `${data.description} (${i + 1}/${repeat})`,
          dueDate: d,
          status: i === 0 ? status : "PENDENTE",
          paidAt: i === 0 ? paidAt : null,
        };
      });
      await prisma.financialEntry.createMany({ data: rows });
      await logAudit(session, "FINANCEIRO", "CRIAR", `Criou ${repeat} parcelas de "${data.description}"`, null);
    } else {
      const created = await prisma.financialEntry.create({ data });
      await logAudit(session, "FINANCEIRO", "CRIAR", `Criou lançamento "${data.description}" (R$ ${amount.toFixed(2)})`, created.id);
    }
  } catch (e) {
    return toFormError(e);
  }
  revalidateAll();
  redirect("/financeiro?ok=" + encodeURIComponent("Lançamento salvo."));
}

export async function markPaid(id: number, returnTo: string) {
  const session = await requireAdmin();
  const entry = await prisma.financialEntry.update({ where: { id }, data: { status: "PAGO", paidAt: new Date() } });
  await logAudit(session, "FINANCEIRO", "BAIXAR", `Baixou lançamento "${entry.description}" como PAGO`, id);
  revalidateAll();
  redirect(returnTo + (returnTo.includes("?") ? "&" : "?") + "ok=" + encodeURIComponent("Lançamento baixado como pago."));
}

export async function deleteEntry(id: number) {
  const session = await requireAdmin();
  const entry = await prisma.financialEntry.findUnique({ where: { id } });
  await prisma.financialEntry.delete({ where: { id } });
  await logAudit(session, "FINANCEIRO", "EXCLUIR", `Excluiu lançamento "${entry?.description ?? id}"`, id);
  revalidateAll();
  redirect("/financeiro?ok=" + encodeURIComponent("Lançamento excluído."));
}
