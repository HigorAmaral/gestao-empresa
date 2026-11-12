import { prisma } from "@/lib/prisma";
import type { ModuleKey } from "@/lib/permissions";

export type AppNotification = {
  id: string;
  level: "critico" | "atencao" | "info";
  module: ModuleKey;
  title: string;
  detail: string;
  href: string;
  count: number;
};

const DAY = 86400000;

/**
 * Central de Alertas: varre todos os módulos e devolve pendências acionáveis em tempo real.
 */
export async function getNotifications(): Promise<AppNotification[]> {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const in3 = new Date(today.getTime() + 3 * DAY);
  const in30 = new Date(today.getTime() + 30 * DAY);
  const week = new Date(today.getTime() - 7 * DAY);
  const curMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const curLabel = `${String(now.getUTCMonth() + 1).padStart(2, "0")}/${now.getUTCFullYear()}`;

  const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);

  const [
    overdueRec,
    overduePay,
    dueSoonPay,
    lowStock,
    lateOs,
    staleQuotes,
    draftInvoices,
    sstExpiring,
    employees,
    payrollThisMonth,
    vacationsLastYear,
    pendingQualityInspections,
    openRncs,
  ] = await Promise.all([
    safe(prisma.financialEntry.aggregate({ where: { type: "RECEITA", status: "PENDENTE", dueDate: { lt: today } }, _count: true, _sum: { amount: true } }), null),
    safe(prisma.financialEntry.aggregate({ where: { type: "DESPESA", status: "PENDENTE", dueDate: { lt: today } }, _count: true, _sum: { amount: true } }), null),
    safe(prisma.financialEntry.aggregate({ where: { type: "DESPESA", status: "PENDENTE", dueDate: { gte: today, lte: in3 } }, _count: true, _sum: { amount: true } }), null),
    safe(prisma.$queryRaw<{ name: string }[]>`SELECT name FROM "Product" WHERE active = true AND stock <= "minStock" ORDER BY stock ASC LIMIT 50`, []),
    safe(prisma.serviceOrder.count({ where: { status: { in: ["ABERTA", "EM_ANDAMENTO", "AGUARDANDO_PECA"] }, expectedDate: { lt: today } } }), 0),
    safe(prisma.sale.count({ where: { status: "ORCAMENTO", date: { lt: week } } }), 0),
    safe(prisma.invoice.count({ where: { status: { in: ["RASCUNHO", "REJEITADA"] } } }), 0),
    safe(prisma.employeeSafetyRecord.findMany({ where: { expiresAt: { lte: in30 }, status: { not: "DEVOLVIDO" } }, select: { expiresAt: true } }), []),
    safe(prisma.employee.findMany({ where: { active: true }, select: { id: true, name: true, hireDate: true, birthDate: true } }), []),
    safe(prisma.financialEntry.count({ where: { category: "Salários", description: { contains: `ref. ${curLabel}` } } }), 0),
    safe(prisma.employeeLeave.findMany({ where: { type: "FERIAS", startDate: { gte: new Date(today.getTime() - 365 * DAY) } }, select: { employeeId: true } }), []),
    safe(prisma.qualityInspection.count({ where: { status: "PENDENTE" } }), 0),
    safe(prisma.nonConformity.findMany({ where: { status: { not: "ENCERRADA" } }, select: { severity: true, dueDate: true } }), []),
  ]);

  const brl = (v: number | null | undefined) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const list: AppNotification[] = [];

  if (overdueRec && overdueRec._count > 0)
    list.push({ id: "fin-rec", level: "critico", module: "financeiro", title: "Contas a receber vencidas", detail: `${overdueRec._count} título(s) em atraso somando ${brl(overdueRec._sum.amount)}. Cobre os clientes.`, href: "/financeiro", count: overdueRec._count });
  if (overduePay && overduePay._count > 0)
    list.push({ id: "fin-pay", level: "critico", module: "financeiro", title: "Contas a pagar vencidas", detail: `${overduePay._count} conta(s) em atraso somando ${brl(overduePay._sum.amount)} (risco de juros/multa).`, href: "/financeiro", count: overduePay._count });
  if (dueSoonPay && dueSoonPay._count > 0)
    list.push({ id: "fin-soon", level: "atencao", module: "financeiro", title: "Contas vencendo em até 3 dias", detail: `${dueSoonPay._count} pagamento(s) próximos: ${brl(dueSoonPay._sum.amount)}.`, href: "/financeiro", count: dueSoonPay._count });
  if (lowStock.length > 0)
    list.push({ id: "est-min", level: "atencao", module: "estoque", title: "Produtos abaixo do estoque mínimo", detail: `${lowStock.length} item(ns): ${lowStock.slice(0, 3).map((p) => p.name).join(", ")}${lowStock.length > 3 ? "…" : ""}. Gere um pedido de compra.`, href: "/estoque", count: lowStock.length });
  if (lateOs > 0)
    list.push({ id: "os-late", level: "critico", module: "os", title: "Ordens de serviço atrasadas", detail: `${lateOs} OS passaram da data prevista de entrega.`, href: "/os", count: lateOs });
  if (staleQuotes > 0)
    list.push({ id: "vendas-orc", level: "info", module: "vendas", title: "Orçamentos parados há mais de 7 dias", detail: `${staleQuotes} orçamento(s) aguardando retorno do cliente. Faça follow-up.`, href: "/vendas", count: staleQuotes });
  if (draftInvoices > 0)
    list.push({ id: "nfe-draft", level: "atencao", module: "vendas", title: "NF-e em rascunho ou rejeitadas", detail: `${draftInvoices} nota(s) aguardando transmissão/correção na SEFAZ.`, href: "/nfe", count: draftInvoices });

  const sstExpired = sstExpiring.filter((r) => r.expiresAt && r.expiresAt < today).length;
  if (sstExpiring.length > 0)
    list.push({ id: "rh-sst", level: sstExpired > 0 ? "critico" : "atencao", module: "funcionarios", title: "EPIs / Exames ASO vencidos ou a vencer", detail: `${sstExpired} vencido(s) e ${sstExpiring.length - sstExpired} vencendo em 30 dias (NR-06/NR-07).`, href: "/funcionarios/sst", count: sstExpiring.length });

  const vacationIds = new Set(vacationsLastYear.map((v) => v.employeeId));
  const vacationRisk = employees.filter((e) => {
    const months = (now.getUTCFullYear() - e.hireDate.getUTCFullYear()) * 12 + (now.getUTCMonth() - e.hireDate.getUTCMonth());
    return months >= 22 && !vacationIds.has(e.id);
  });
  if (vacationRisk.length > 0)
    list.push({ id: "rh-ferias", level: "critico", module: "funcionarios", title: "Férias perto do limite concessivo", detail: `${vacationRisk.map((e) => e.name).join(", ")} — conceda férias para evitar pagamento em dobro (Art. 137 CLT).`, href: "/funcionarios/ferias", count: vacationRisk.length });

  const birthdays = employees.filter((e) => e.birthDate && e.birthDate.getUTCMonth() === now.getUTCMonth());
  if (birthdays.length > 0)
    list.push({ id: "rh-niver", level: "info", module: "funcionarios", title: "Aniversariantes do mês", detail: birthdays.map((e) => `${e.name} (${String(e.birthDate!.getUTCDate()).padStart(2, "0")})`).join(", "), href: "/funcionarios", count: birthdays.length });

  if (payrollThisMonth === 0 && now.getUTCDate() >= 20 && employees.length > 0)
    list.push({ id: "rh-folha", level: "atencao", module: "funcionarios", title: `Folha de ${curLabel} ainda não fechada`, detail: "A automação diária fecha a folha a partir do dia 25, ou feche agora em 1 clique.", href: `/funcionarios/folha?month=${curMonth}`, count: 1 });

  if (pendingQualityInspections > 0)
    list.push({ id: "sgq-insp", level: "atencao", module: "qualidade", title: "Inspeções de Qualidade pendentes", detail: `${pendingQualityInspections} lote(s) de recebimento ou produção aguardando checklist de qualidade.`, href: "/qualidade", count: pendingQualityInspections });

  if (openRncs.length > 0) {
    const overdueRncs = openRncs.filter((r) => r.dueDate && r.dueDate < today).length;
    const criticalRncs = openRncs.filter((r) => r.severity === "CRITICA" || r.severity === "ALTA").length;
    list.push({
      id: "sgq-rnc",
      level: overdueRncs > 0 || criticalRncs > 0 ? "critico" : "atencao",
      module: "qualidade",
      title: "Não Conformidades (RNC) em aberto",
      detail: `${openRncs.length} RNC(s) abertas (${overdueRncs} vencida(s), ${criticalRncs} alta/crítica).`,
      href: "/qualidade?tab=rncs",
      count: openRncs.length,
    });
  }

  const order = { critico: 0, atencao: 1, info: 2 } as const;
  return list.sort((a, b) => order[a.level] - order[b.level]);
}
