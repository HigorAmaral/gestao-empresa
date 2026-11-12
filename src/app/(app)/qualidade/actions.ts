"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { ensureStockLocationTables } from "@/lib/stock-location";
import {
  defaultChecklistForType,
  generateInspectionCode,
  generateRncCode,
  type QualityChecklistItem,
} from "@/lib/quality";

function revalidateQuality() {
  revalidateTag("sidebar-alerts", "max");
  for (const p of ["/qualidade", "/producao", "/recebimento", "/"]) {
    revalidatePath(p);
  }
}

export async function createInspectionAction(formData: FormData) {
  const session = await requireUser();
  await ensureStockLocationTables();

  const type = String(formData.get("type") || "PRODUCAO").trim();
  const title = String(formData.get("title") || "").trim();
  const productIdRaw = String(formData.get("productId") || "").trim();
  const productId = productIdRaw ? Number(productIdRaw) : null;
  const referenceCode = String(formData.get("referenceCode") || "").trim() || null;
  const batch = String(formData.get("batch") || "").trim() || null;
  const sampleSize = Math.max(1, Number(formData.get("sampleSize") || 1));
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!title) throw new Error("Informe o título da inspeção.");

  const code = await generateInspectionCode();
  const checklist = defaultChecklistForType(type);

  const created = await prisma.qualityInspection.create({
    data: {
      code,
      type,
      title,
      productId: productId && productId > 0 ? productId : null,
      referenceCode,
      batch,
      sampleSize,
      defectiveCount: 0,
      checklistJson: JSON.stringify(checklist),
      status: "PENDENTE",
      inspectorName: session.name,
      notes,
    },
  });

  await logAudit(session, "QUALIDADE", "CRIAR", `Criou inspeção ${code}: "${title}"`, created.id);
  revalidateQuality();
  return { ok: true, id: created.id, code };
}

export async function completeInspectionAction(input: {
  id: number;
  status: "APROVADA" | "APROVADA_RESSALVA" | "REPROVADA";
  sampleSize: number;
  defectiveCount: number;
  checklist: QualityChecklistItem[];
  notes?: string;
}) {
  const session = await requireUser();
  await ensureStockLocationTables();

  const insp = await prisma.qualityInspection.findUnique({
    where: { id: input.id },
    include: { product: { select: { id: true, name: true } } },
  });
  if (!insp) throw new Error("Inspeção de qualidade não encontrada.");

  const sampleSize = Math.max(1, Math.round(input.sampleSize || insp.sampleSize));
  const defectiveCount = Math.max(0, Math.min(sampleSize, Math.round(input.defectiveCount || 0)));

  await prisma.qualityInspection.update({
    where: { id: insp.id },
    data: {
      status: input.status,
      sampleSize,
      defectiveCount,
      checklistJson: JSON.stringify(input.checklist),
      inspectorName: session.name,
      notes: input.notes?.trim() || insp.notes,
      inspectedAt: new Date(),
    },
  });

  let autoRncCode: string | null = null;
  if (input.status === "REPROVADA") {
    const existingRnc = await prisma.nonConformity.findFirst({
      where: { inspectionId: insp.id, status: { not: "ENCERRADA" } },
    });

    if (!existingRnc) {
      const defectRatio = defectiveCount / sampleSize;
      const severity = defectRatio >= 0.3 ? "CRITICA" : defectRatio >= 0.1 ? "ALTA" : "MEDIA";
      const failedItems = input.checklist
        .filter((c) => !c.ok)
        .map((c) => c.label + (c.note ? ` (${c.note})` : ""));
      const rncCode = await generateRncCode();
      const dueDate = new Date(Date.now() + 7 * 86400000);

      await prisma.nonConformity.create({
        data: {
          code: rncCode,
          title: `Reprovação ${insp.code} — ${insp.title}`,
          origin: insp.type === "RECEBIMENTO" ? "RECEBIMENTO" : insp.type === "PRODUCAO" ? "PRODUCAO" : "INSPECAO",
          severity,
          status: "ABERTA",
          inspectionId: insp.id,
          productId: insp.productId,
          description:
            `Gerada automaticamente pela reprovação da inspeção ${insp.code}` +
            (insp.referenceCode ? ` (Ref: ${insp.referenceCode})` : "") +
            `. Amostra: ${sampleSize} | Defeituosos: ${defectiveCount}.` +
            (failedItems.length > 0 ? ` Itens reprovados: ${failedItems.join("; ")}.` : ""),
          responsibleName: session.name,
          dueDate,
        },
      });
      autoRncCode = rncCode;
    }
  }

  await logAudit(
    session,
    "QUALIDADE",
    "INSPECIONAR",
    `Concluiu inspeção ${insp.code} como ${input.status} (${defectiveCount}/${sampleSize} defeitos)` +
      (autoRncCode ? ` — RNC automática ${autoRncCode} aberta` : ""),
    insp.id,
  );

  revalidateQuality();
  return { ok: true, autoRncCode };
}

export async function createRncAction(formData: FormData) {
  const session = await requireUser();
  await ensureStockLocationTables();

  const title = String(formData.get("title") || "").trim();
  const origin = String(formData.get("origin") || "INTERNA").trim();
  const severity = String(formData.get("severity") || "MEDIA").trim();
  const productIdRaw = String(formData.get("productId") || "").trim();
  const productId = productIdRaw ? Number(productIdRaw) : null;
  const description = String(formData.get("description") || "").trim();
  const rootCause = String(formData.get("rootCause") || "").trim() || null;
  const correctiveAction = String(formData.get("correctiveAction") || "").trim() || null;
  const responsibleName = String(formData.get("responsibleName") || "").trim() || session.name;
  const dueDateRaw = String(formData.get("dueDate") || "").trim();

  if (!title || !description) {
    throw new Error("Informe o título e a descrição da Não Conformidade.");
  }

  const code = await generateRncCode();
  const created = await prisma.nonConformity.create({
    data: {
      code,
      title,
      origin,
      severity,
      status: "ABERTA",
      productId: productId && productId > 0 ? productId : null,
      description,
      rootCause,
      correctiveAction,
      responsibleName,
      dueDate: dueDateRaw ? new Date(`${dueDateRaw}T00:00:00.000Z`) : new Date(Date.now() + 7 * 86400000),
    },
  });

  await logAudit(session, "QUALIDADE", "CRIAR", `Abriu RNC ${code}: "${title}" (${severity})`, created.id);
  revalidateQuality();
  return { ok: true, id: created.id, code };
}

export async function updateRncAction(formData: FormData) {
  const session = await requireUser();
  await ensureStockLocationTables();

  const id = Number(formData.get("id"));
  const status = String(formData.get("status") || "ABERTA").trim();
  const severity = String(formData.get("severity") || "MEDIA").trim();
  const rootCause = String(formData.get("rootCause") || "").trim() || null;
  const correctiveAction = String(formData.get("correctiveAction") || "").trim() || null;
  const responsibleName = String(formData.get("responsibleName") || "").trim() || null;
  const dueDateRaw = String(formData.get("dueDate") || "").trim();

  const existing = await prisma.nonConformity.findUnique({ where: { id } });
  if (!existing) throw new Error("RNC não encontrada.");

  await prisma.nonConformity.update({
    where: { id },
    data: {
      status,
      severity,
      rootCause,
      correctiveAction,
      responsibleName,
      dueDate: dueDateRaw ? new Date(`${dueDateRaw}T00:00:00.000Z`) : existing.dueDate,
      closedAt: status === "ENCERRADA" ? existing.closedAt ?? new Date() : null,
    },
  });

  await logAudit(session, "QUALIDADE", "EDITAR", `Atualizou RNC ${existing.code} para ${status}`, id);
  revalidateQuality();
  return { ok: true };
}
