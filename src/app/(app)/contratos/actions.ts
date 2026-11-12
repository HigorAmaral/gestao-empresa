"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function createContractAction(formData: FormData) {
  const user = await requireAdmin();

  const clientId = Number(formData.get("clientId"));
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const amount = parseFloat(formData.get("amount") as string) || 0;
  const recurrence = (formData.get("recurrence") as string) || "MENSAL";
  const dueDay = Math.min(31, Math.max(1, Number(formData.get("dueDay")) || 10));
  const autoGenerateFinEntry = formData.get("autoGenerateFinEntry") === "on";
  const autoGenerateOS = formData.get("autoGenerateOS") === "on";
  const osServiceDescription = (formData.get("osServiceDescription") as string)?.trim() || null;
  const startDateStr = formData.get("startDate") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!clientId || !title || amount <= 0) {
    throw new Error("Preencha cliente, título e valor do contrato.");
  }

  const startDate = startDateStr ? new Date(startDateStr) : new Date();

  // Próxima data de cobrança inicial baseada no dia de vencimento
  const nextBilling = new Date(startDate);
  nextBilling.setDate(dueDay);
  if (nextBilling < startDate) {
    nextBilling.setMonth(nextBilling.getMonth() + 1);
  }

  const contract = await prisma.contract.create({
    data: {
      clientId,
      title,
      description,
      amount,
      recurrence,
      dueDay,
      status: "ATIVO",
      autoGenerateFinEntry,
      autoGenerateOS,
      osServiceDescription,
      startDate,
      nextBillingDate: nextBilling,
      notes,
    },
  });

  await logAudit(user, "CONTRATOS", "CRIAR", `Criou contrato "${title}" (R$ ${amount.toFixed(2)})`, contract.id);

  revalidatePath("/contratos");
}

export async function updateContractStatusAction(id: number, status: string) {
  const user = await requireAdmin();

  await prisma.contract.update({
    where: { id },
    data: { status },
  });

  await logAudit(user, "CONTRATOS", "STATUS", `Alterou status do contrato #${id} para ${status}`, id);
  revalidatePath("/contratos");
}

export async function billContractNowAction(id: number) {
  const user = await requireAdmin();

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: { client: true },
  });

  if (!contract) throw new Error("Contrato não encontrado.");

  const now = new Date();
  const curLabel = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

  // 1. Gera lançamento a receber no Financeiro se configurado
  let finId: number | null = null;
  if (contract.autoGenerateFinEntry) {
    const due = new Date(now.getFullYear(), now.getMonth(), contract.dueDay);
    const fin = await prisma.financialEntry.create({
      data: {
        type: "RECEITA",
        description: `Mensalidade Contrato #${contract.id} — ${contract.title} (${curLabel})`,
        category: "Contratos / Assinaturas",
        amount: contract.amount,
        dueDate: due,
        status: "PENDENTE",
        notes: `Cliente: ${contract.client.name} | Gerado manualmente via Contratos`,
      },
    });
    finId = fin.id;
  }

  // 2. Gera Ordem de Serviço preventiva se configurado
  let osId: number | null = null;
  if (contract.autoGenerateOS) {
    const os = await prisma.serviceOrder.create({
      data: {
        clientId: contract.clientId,
        equipment: `Contrato de Serviço: ${contract.title}`,
        status: "ABERTA",
        reportedIssue: contract.osServiceDescription || `Manutenção preventiva mensal do contrato #${contract.id}`,
        laborCost: contract.amount,
        total: contract.amount,
        notes: `OS gerada automaticamente pelo Contrato #${contract.id} (${curLabel})`,
      },
    });
    osId = os.id;
  }

  // 3. Atualiza data do próximo faturamento
  const next = new Date(contract.nextBillingDate || now);
  next.setMonth(next.getMonth() + 1);

  await prisma.contract.update({
    where: { id },
    data: {
      lastBilledAt: now,
      nextBillingDate: next,
    },
  });

  await logAudit(user, "CONTRATOS", "FATURAR", `Faturou mensalidade do contrato #${id} (${curLabel})`, id);

  revalidatePath("/contratos");
  revalidatePath("/financeiro");
  revalidatePath("/os");
}
