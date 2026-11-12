"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function updateSaleStageAction(saleId: number, stage: string, lossReason?: string) {
  const user = await requireAdmin("vendas");

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
  });

  if (!sale) throw new Error("Venda ou oportunidade não encontrada.");

  const data: {
    pipelineStage: string;
    lossReason?: string | null;
    status?: string;
  } = {
    pipelineStage: stage,
    lossReason: stage === "PERDIDO" ? lossReason || "Não informado" : null,
  };

  // Se mover para FECHADO, garante status CONFIRMADA
  if (stage === "FECHADO" && sale.status === "ORCAMENTO") {
    data.status = "CONFIRMADA";
  } else if (stage === "PERDIDO") {
    data.status = "CANCELADA";
  }

  await prisma.sale.update({
    where: { id: saleId },
    data,
  });

  await logAudit(user, "VENDAS", "PIPELINE", `Oportunidade #${saleId} movida para ${stage}`, saleId);

  revalidatePath("/vendas");
  revalidatePath("/vendas/funil");
}

export async function createCrmOpportunityAction(formData: FormData) {
  const user = await requireAdmin("vendas");

  const clientId = Number(formData.get("clientId"));
  const estimatedAmount = parseFloat(formData.get("amount") as string) || 0;
  const stage = (formData.get("stage") as string) || "NOVO_LEAD";
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!clientId) {
    throw new Error("Selecione um cliente para a oportunidade.");
  }

  const sale = await prisma.sale.create({
    data: {
      clientId,
      userId: user.userId,
      status: "ORCAMENTO",
      pipelineStage: stage,
      subtotal: estimatedAmount,
      total: estimatedAmount,
      notes: notes ? `[CRM Lead]: ${notes}` : "[CRM Oportunidade]",
    },
  });

  await logAudit(user, "VENDAS", "CRIAR_LEAD", `Criou lead comercial #${sale.id} (R$ ${estimatedAmount.toFixed(2)})`, sale.id);

  revalidatePath("/vendas/funil");
}
