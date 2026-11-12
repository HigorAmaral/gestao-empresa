import { prisma } from "@/lib/prisma";
import { ensureStockLocationTables } from "@/lib/stock-location";

export type QualityChecklistItem = {
  label: string;
  ok: boolean;
  note?: string;
};

export const QUALITY_TYPES = [
  { value: "RECEBIMENTO", label: "Recebimento de Materiais" },
  { value: "PRODUCAO", label: "Produção / Lote OP" },
  { value: "OS", label: "Ordem de Serviço" },
  { value: "PRODUTO", label: "Produto Acabado" },
  { value: "AUDITORIA", label: "Auditoria Interna (5S/ISO)" },
] as const;

export const QUALITY_STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  APROVADA: "Aprovada",
  APROVADA_RESSALVA: "Aprovada c/ Ressalva",
  REPROVADA: "Reprovada",
};

export const RNC_STATUS_LABEL: Record<string, string> = {
  ABERTA: "Aberta",
  EM_ANALISE: "Em Análise",
  ACAO_CORRETIVA: "Ação Corretiva (CAPA)",
  VERIFICACAO: "Verificação de Eficácia",
  ENCERRADA: "Encerrada",
};

export const RNC_SEVERITY_LABEL: Record<string, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  CRITICA: "Crítica",
};

export function defaultChecklistForType(type: string): QualityChecklistItem[] {
  switch (type) {
    case "RECEBIMENTO":
      return [
        { label: "Embalagem íntegra e sem violação", ok: true },
        { label: "Quantidade conferida com NF-e / Pedido", ok: true },
        { label: "Especificação técnica / validade conforme", ok: true },
        { label: "Ausência de avarias, umidade ou contaminação", ok: true },
      ];
    case "PRODUCAO":
      return [
        { label: "Dimensões / especificações dentro da tolerância", ok: true },
        { label: "Acabamento visual e montagem conformes", ok: true },
        { label: "Identificação de lote e rastreabilidade aplicada", ok: true },
        { label: "Teste funcional / resistência aprovado", ok: true },
      ];
    case "OS":
      return [
        { label: "Defeito relatado pelo cliente solucionado", ok: true },
        { label: "Testes operacionais realizados em bancada", ok: true },
        { label: "Limpeza, parafusos e lacres conferidos", ok: true },
      ];
    case "AUDITORIA":
      return [
        { label: "Organização e limpeza do setor (5S)", ok: true },
        { label: "EPIs utilizados conforme NR-06", ok: true },
        { label: "Registros e rastreabilidade atualizados", ok: true },
      ];
    default:
      return [
        { label: "Conformidade visual e embalagem", ok: true },
        { label: "Especificação e funcionalidade verificadas", ok: true },
        { label: "Etiquetagem / SKU conferidos", ok: true },
      ];
  }
}

export function parseChecklist(raw: string | null | undefined, type: string): QualityChecklistItem[] {
  if (!raw) return defaultChecklistForType(type);
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((i) => ({
        label: String(i?.label || "Item de verificação"),
        ok: Boolean(i?.ok ?? true),
        note: i?.note ? String(i.note) : undefined,
      }));
    }
  } catch {}
  return defaultChecklistForType(type);
}

export async function generateInspectionCode(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const count = await prisma.qualityInspection.count({
    where: { code: { startsWith: `IQ-${year}-` } },
  });
  return `IQ-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function generateRncCode(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const count = await prisma.nonConformity.count({
    where: { code: { startsWith: `RNC-${year}-` } },
  });
  return `RNC-${year}-${String(count + 1).padStart(4, "0")}`;
}

/**
 * Cria automaticamente uma inspeção de qualidade pendente a partir de eventos do ERP
 * (ex: Recebimento de Mercadorias ou Conclusão de Ordem de Produção).
 */
export async function createAutomaticInspection(params: {
  type: "RECEBIMENTO" | "PRODUCAO" | "OS" | "PRODUTO";
  title: string;
  productId?: number | null;
  referenceCode?: string | null;
  batch?: string | null;
  sampleSize?: number;
  notes?: string | null;
}) {
  await ensureStockLocationTables();

  if (params.referenceCode) {
    const existing = await prisma.qualityInspection.findFirst({
      where: { type: params.type, referenceCode: params.referenceCode },
    });
    if (existing) return existing;
  }

  const code = await generateInspectionCode();
  const checklist = defaultChecklistForType(params.type);

  return prisma.qualityInspection.create({
    data: {
      code,
      type: params.type,
      title: params.title,
      productId: params.productId ?? null,
      referenceCode: params.referenceCode ?? null,
      batch: params.batch ?? null,
      sampleSize: Math.max(1, Math.round(params.sampleSize ?? 1)),
      defectiveCount: 0,
      checklistJson: JSON.stringify(checklist),
      status: "PENDENTE",
      notes: params.notes ?? "Gerada automaticamente pelo fluxo operacional do sistema.",
    },
  });
}

export async function getQualityDashboardData() {
  await ensureStockLocationTables();
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const [inspections, rncs, products] = await Promise.all([
    prisma.qualityInspection.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
      include: { product: { select: { id: true, name: true, sku: true } } },
    }),
    prisma.nonConformity.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        inspection: { select: { id: true, code: true, title: true } },
      },
    }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true },
    }),
  ]);

  const completed = inspections.filter((i) => i.status !== "PENDENTE");
  const approved = completed.filter((i) => i.status === "APROVADA" || i.status === "APROVADA_RESSALVA");
  const approvalRate = completed.length > 0 ? Math.round((approved.length / completed.length) * 1000) / 10 : 100;

  const totalSampled = completed.reduce((acc, i) => acc + Math.max(1, i.sampleSize), 0);
  const totalDefective = completed.reduce((acc, i) => acc + Math.max(0, i.defectiveCount), 0);
  const defectRatePct = totalSampled > 0 ? Math.round((totalDefective / totalSampled) * 1000) / 10 : 0;

  const pendingInspections = inspections.filter((i) => i.status === "PENDENTE").length;
  const openRncs = rncs.filter((r) => r.status !== "ENCERRADA").length;
  const criticalRncs = rncs.filter((r) => r.status !== "ENCERRADA" && (r.severity === "CRITICA" || r.severity === "ALTA")).length;
  const overdueRncs = rncs.filter((r) => r.status !== "ENCERRADA" && r.dueDate && r.dueDate < todayUtc).length;

  const byType = QUALITY_TYPES.map((t) => {
    const list = inspections.filter((i) => i.type === t.value && i.status !== "PENDENTE");
    const okCount = list.filter((i) => i.status === "APROVADA" || i.status === "APROVADA_RESSALVA").length;
    return {
      type: t.value,
      label: t.label,
      total: list.length,
      approved: okCount,
      rejected: list.length - okCount,
      rate: list.length > 0 ? Math.round((okCount / list.length) * 100) : 100,
    };
  });

  return {
    inspections: inspections.map((i) => ({
      ...i,
      inspectedAt: i.inspectedAt?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    })),
    rncs: rncs.map((r) => ({
      ...r,
      dueDate: r.dueDate?.toISOString() ?? null,
      closedAt: r.closedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    products,
    metrics: {
      totalInspections: inspections.length,
      pendingInspections,
      approvalRate,
      defectRatePct,
      openRncs,
      criticalRncs,
      overdueRncs,
      closedRncs: rncs.length - openRncs,
    },
    byType,
  };
}
