"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function reconcileExistingEntryAction(entryId: number, paidDateStr?: string) {
  const user = await requireAdmin();

  const entry = await prisma.financialEntry.findUnique({
    where: { id: entryId },
  });

  if (!entry) throw new Error("Lançamento financeiro não encontrado.");

  const paidDate = paidDateStr ? new Date(paidDateStr) : new Date();

  await prisma.financialEntry.update({
    where: { id: entryId },
    data: {
      status: "PAGO",
      paidAt: paidDate,
      notes: `${entry.notes ? entry.notes + " | " : ""}Baixa confirmada via Conciliação de Extrato Bancário OFX`,
    },
  });

  await logAudit(user, "FINANCEIRO", "CONCILIAR_OFX", `Baixa via OFX #${entryId} (${entry.description})`, entryId);

  revalidatePath("/financeiro");
  revalidatePath("/financeiro/conciliacao");
}

export async function createAndReconcileEntryAction(formData: FormData) {
  const user = await requireAdmin();

  const type = (formData.get("type") as string) === "CREDIT" ? "RECEITA" : "DESPESA";
  const description = (formData.get("description") as string)?.trim() || "Transação Bancária OFX";
  const category = (formData.get("category") as string)?.trim() || (type === "RECEITA" ? "Receitas Diversas" : "Tarifas Bancárias");
  const amount = parseFloat(formData.get("amount") as string) || 0;
  const dateStr = formData.get("date") as string;
  const bankAccountIdStr = formData.get("bankAccountId") as string;
  const bankAccountId = bankAccountIdStr ? Number(bankAccountIdStr) : null;

  if (amount <= 0) throw new Error("Valor inválido.");

  const date = dateStr ? new Date(dateStr) : new Date();

  const created = await prisma.financialEntry.create({
    data: {
      type,
      description,
      category,
      amount,
      dueDate: date,
      paidAt: date,
      status: "PAGO",
      bankAccountId: bankAccountId || undefined,
      notes: "Gerado e conciliado automaticamente a partir do Extrato Bancário OFX",
    },
  });

  await logAudit(user, "FINANCEIRO", "LANCAR_OFX", `Lançou e baixou via OFX: "${description}" (R$ ${amount.toFixed(2)})`, created.id);

  revalidatePath("/financeiro");
  revalidatePath("/financeiro/conciliacao");
}
