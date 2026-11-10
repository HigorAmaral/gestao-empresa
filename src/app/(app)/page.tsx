import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  CheckCircle2,
  CreditCard,
  Plus,
  Target,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { brl, fmtDate, fmtDateTime, monthKey, monthLabel, num, todayUTC } from "@/lib/format";
import { BarChart, FlashMessages, HBarList, PageHeader, StatusBadge } from "@/components/ui";
import { markPaid } from "./financeiro/actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

type PeriodKey = "hoje" | "7d" | "mes" | "mes_ant" | "ano";

function resolvePeriod(raw: string | undefined, today: Date) {
  const key: PeriodKey =
    raw === "hoje" || raw === "7d" || raw === "mes" || raw === "mes_ant" || raw === "ano" ? raw : "mes";

  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const d = today.getUTCDate();

  if (key === "hoje") {
    const start = new Date(Date.UTC(y, m, d));
    const end = new Date(Date.UTC(y, m, d + 1));
    const prevStart = new Date(Date.UTC(y, m, d - 1));
    const prevEnd = start;
    return {
      key,
      label: "Hoje",
      prevLabel: "ontem",
      start,
      end,
      prevStart,
      prevEnd,
      goalMultiplier: 1 / 22,
    };
  }

  if (key === "7d") {
    const start = new Date(Date.UTC(y, m, d - 6));
    const end = new Date(Date.UTC(y, m, d + 1));
    const prevStart = new Date(Date.UTC(y, m, d - 13));
    const prevEnd = start;
    return {
      key,
      label: "Últimos 7 dias",
      prevLabel: "7 dias anteriores",
      start,
      end,
      prevStart,
      prevEnd,
      goalMultiplier: 0.25,
    };
  }

  if (key === "mes_ant") {
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 1));
    const prevStart = new Date(Date.UTC(y, m - 2, 1));
    const prevEnd = start;
    return {
      key,
      label: "Mês passado",
      prevLabel: "2 meses atrás",
      start,
      end,
      prevStart,
      prevEnd,
      goalMultiplier: 1,
    };
  }

  if (key === "ano") {
    const start = new Date(Date.UTC(y, 0, 1));
    const end = new Date(Date.UTC(y + 1, 0, 1));
    const prevStart = new Date(Date.UTC(y - 1, 0, 1));
    const prevEnd = start;
    return {
      key,
      label: `Ano ${y}`,
      prevLabel: `ano ${y - 1}`,
      start,
      end,
      prevStart,
      prevEnd,
      goalMultiplier: 12,
    };
  }

  // Default: "mes" (Este mês)
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 1));
  const prevStart = new Date(Date.UTC(y, m - 1, 1));
  const prevEnd = start;
  return {
    key: "mes" as PeriodKey,
    label: "Este mês",
    prevLabel: "mês anterior",
    start,
    end,
    prevStart,
    prevEnd,
    goalMultiplier: 1,
  };
}

function pctDiff(curr: number, prev: number): number | null {
  if (prev <= 0) return curr > 0 ? 100 : null;
  return ((curr - prev) / prev) * 100;
}

const PRIORITY_WEIGHT: Record<string, number> = {
  URGENTE: 0,
  ALTA: 1,
  NORMAL: 2,
  BAIXA: 3,
};

export default async function DashboardPage({ searchParams }: { searchParams: SP }) {
  const session = await requireUser();
  const sp = await searchParams;
  const isAdmin = session.role === "ADMIN";
  const today = todayUTC();
  const rawPeriodo = typeof sp.periodo === "string" ? sp.periodo : undefined;
  const period = resolvePeriod(rawPeriodo, today);

  const sixMonthsAgo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1));
  const sevenDaysAhead = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 7));

  const [
    salesPeriod,
    salesPrevPeriod,
    recPeriod,
    recPrevPeriod,
    desPeriod,
    desPrevPeriod,
    recOpen,
    desOpen,
    overdueCount,
    clientCount,
    productCount,
    openOsCount,
    lowStock,
    recentSales,
    sales6m,
    entries6m,
    topItems,
    periodSalesDetail,
    upcomingFinancial,
    activeServiceOrders,
    recentAuditLogs,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { status: "CONFIRMADA", date: { gte: period.start, lt: period.end } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.sale.aggregate({
      where: { status: "CONFIRMADA", date: { gte: period.prevStart, lt: period.prevEnd } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.financialEntry.aggregate({
      where: { type: "RECEITA", status: "PAGO", dueDate: { gte: period.start, lt: period.end } },
      _sum: { amount: true },
    }),
    prisma.financialEntry.aggregate({
      where: { type: "RECEITA", status: "PAGO", dueDate: { gte: period.prevStart, lt: period.prevEnd } },
      _sum: { amount: true },
    }),
    prisma.financialEntry.aggregate({
      where: { type: "DESPESA", status: "PAGO", dueDate: { gte: period.start, lt: period.end } },
      _sum: { amount: true },
    }),
    prisma.financialEntry.aggregate({
      where: { type: "DESPESA", status: "PAGO", dueDate: { gte: period.prevStart, lt: period.prevEnd } },
      _sum: { amount: true },
    }),
    prisma.financialEntry.aggregate({
      where: { type: "RECEITA", status: "PENDENTE" },
      _sum: { amount: true },
    }),
    prisma.financialEntry.aggregate({
      where: { type: "DESPESA", status: "PENDENTE" },
      _sum: { amount: true },
    }),
    prisma.financialEntry.count({
      where: { status: "PENDENTE", dueDate: { lt: today } },
    }),
    prisma.client.count({ where: { active: true } }),
    prisma.product.count({ where: { active: true } }),
    prisma.serviceOrder.count({ where: { status: { in: ["ABERTA", "EM_ANDAMENTO", "AGUARDANDO_PECA"] } } }),
    prisma.$queryRaw<{ id: number; sku: string; name: string; stock: number; minStock: number; unit: string }[]>`
      SELECT id, sku, name, stock, "minStock", unit FROM "Product" WHERE active = true AND stock <= "minStock" ORDER BY (stock - "minStock") ASC LIMIT 6`,
    prisma.sale.findMany({
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: 6,
      include: { client: true },
    }),
    prisma.sale.findMany({
      where: { status: "CONFIRMADA", date: { gte: sixMonthsAgo } },
      select: { date: true, total: true },
    }),
    prisma.financialEntry.findMany({
      where: { status: "PAGO", dueDate: { gte: sixMonthsAgo } },
      select: { dueDate: true, type: true, amount: true },
    }),
    prisma.saleItem.groupBy({
      by: ["productId"],
      where: { sale: { status: "CONFIRMADA", date: { gte: period.start, lt: period.end } } },
      _sum: { total: true, quantity: true },
      orderBy: { _sum: { total: "desc" } },
      take: 5,
    }),
    prisma.sale.findMany({
      where: { status: "CONFIRMADA", date: { gte: period.start, lt: period.end } },
      select: {
        total: true,
        paymentMethod: true,
        clientId: true,
        client: { select: { name: true } },
        items: {
          select: {
            quantity: true,
            total: true,
            product: { select: { costPrice: true } },
          },
        },
      },
    }),
    isAdmin
      ? prisma.financialEntry.findMany({
          where: {
            status: "PENDENTE",
            dueDate: { lte: sevenDaysAhead },
          },
          orderBy: [{ dueDate: "asc" }, { id: "asc" }],
          take: 8,
        })
      : Promise.resolve([]),
    prisma.serviceOrder.findMany({
      where: { status: { in: ["ABERTA", "EM_ANDAMENTO", "AGUARDANDO_PECA"] } },
      include: { client: true, technician: true },
      orderBy: [{ openedAt: "asc" }],
      take: 12,
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 7,
    }),
  ]);

  const topProductIds = topItems.map((t) => t.productId);
  const topProducts = topProductIds.length
    ? await prisma.product.findMany({ where: { id: { in: topProductIds } } })
    : [];
  const prodById = new Map(topProducts.map((p) => [p.id, p]));

  // Histórico de 6 meses para os gráficos
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    months.push(monthKey(d));
  }
  const salesByMonth = new Map<string, number>(months.map((m) => [m, 0]));
  for (const s of sales6m) {
    const k = monthKey(new Date(s.date));
    if (salesByMonth.has(k)) salesByMonth.set(k, (salesByMonth.get(k) ?? 0) + s.total);
  }
  const recByMonth = new Map<string, number>(months.map((m) => [m, 0]));
  const desByMonth = new Map<string, number>(months.map((m) => [m, 0]));
  for (const e of entries6m) {
    const k = monthKey(new Date(e.dueDate));
    if (!recByMonth.has(k)) continue;
    if (e.type === "RECEITA") recByMonth.set(k, (recByMonth.get(k) ?? 0) + e.amount);
    else desByMonth.set(k, (desByMonth.get(k) ?? 0) + e.amount);
  }

  // Métricas do período selecionado vs período anterior
  const currSalesTotal = salesPeriod._sum.total ?? 0;
  const prevSalesTotal = salesPrevPeriod._sum.total ?? 0;
  const salesGrowth = pctDiff(currSalesTotal, prevSalesTotal);

  const salesCount = salesPeriod._count ?? 0;
  const ticketMedio = salesCount > 0 ? currSalesTotal / salesCount : 0;

  // Cálculo de Custo (CMV), Lucro Bruto, Meios de Pagamento e Top Clientes no período
  let totalCostOfGoods = 0;
  const byPayment = new Map<string, number>();
  const byClient = new Map<string, number>();

  for (const sale of periodSalesDetail) {
    const pm = sale.paymentMethod?.trim() || "Não informado";
    byPayment.set(pm, (byPayment.get(pm) ?? 0) + sale.total);

    const clientName = sale.client?.name ?? "Consumidor final";
    byClient.set(clientName, (byClient.get(clientName) ?? 0) + sale.total);

    for (const item of sale.items) {
      totalCostOfGoods += item.quantity * (item.product?.costPrice ?? 0);
    }
  }

  const grossProfit = currSalesTotal - totalCostOfGoods;
  const grossMarginPct = currSalesTotal > 0 ? (grossProfit / currSalesTotal) * 100 : 0;

  const paymentRows = Array.from(byPayment.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const topClientRows = Array.from(byClient.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const currRec = recPeriod._sum.amount ?? 0;
  const prevRec = recPrevPeriod._sum.amount ?? 0;
  const recGrowth = pctDiff(currRec, prevRec);

  const currDes = desPeriod._sum.amount ?? 0;
  const netPeriod = currRec - currDes;

  // Meta do período (base mensal de R$ 30.000 ou 20% acima do período anterior)
  const baseGoal = Math.max(30000 * period.goalMultiplier, prevSalesTotal * 1.2);
  const goalPct = baseGoal > 0 ? Math.min(100, (currSalesTotal / baseGoal) * 100) : 0;
  const goalRemaining = Math.max(0, baseGoal - currSalesTotal);

  // Ordenar OS em aberto priorizando URGENTE e ALTA
  const sortedActiveOs = [...activeServiceOrders]
    .sort((a, b) => (PRIORITY_WEIGHT[a.priority] ?? 9) - (PRIORITY_WEIGHT[b.priority] ?? 9))
    .slice(0, 6);

  const urgentOsCount = activeServiceOrders.filter(
    (os) => os.priority === "URGENTE" || os.priority === "ALTA",
  ).length;

  const returnUrl = `/?periodo=${period.key}`;

  return (
    <>
      <PageHeader
        title={`Olá, ${session.name.split(" ")[0]}`}
        subtitle="Painel executivo e operacional em tempo real"
        actions={
          <>
            <Link className="btn" href="/vendas/novo">
              <Plus size={15} /> Nova venda
            </Link>
            <Link className="btn secondary" href="/os/novo">
              <Wrench size={15} /> Nova OS
            </Link>
            <Link className="btn secondary" href="/clientes/novo">
              <Plus size={15} /> Cliente
            </Link>
            <Link className="btn secondary" href="/produtos/novo">
              <Plus size={15} /> Produto
            </Link>
          </>
        }
      />
      <FlashMessages sp={sp} />

      {/* 1. Seletor de Período */}
      <div className="period-bar">
        <div className="muted small">
          Exibindo indicadores de: <strong style={{ color: "var(--text)" }}>{period.label}</strong> (comparado com{" "}
          {period.prevLabel})
        </div>
        <div className="period-tabs">
          {(
            [
              { k: "hoje", label: "Hoje" },
              { k: "7d", label: "7 dias" },
              { k: "mes", label: "Este mês" },
              { k: "mes_ant", label: "Mês passado" },
              { k: "ano", label: "Ano atual" },
            ] as const
          ).map((t) => (
            <Link
              key={t.k}
              href={`/?periodo=${t.k}`}
              className={`period-tab ${period.key === t.k ? "active" : ""}`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      {/* 2. Barra de Meta de Faturamento */}
      <div className="goal-card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="row" style={{ gap: 8 }}>
            <Target size={16} />
            <span className="bold">Meta de Faturamento ({period.label})</span>
            <span className="badge blue">{num(goalPct, 1)}% atingida</span>
          </div>
          <div className="small">
            <span className="bold">{brl(currSalesTotal)}</span> <span className="muted">de {brl(baseGoal)}</span>
          </div>
        </div>
        <div className="goal-track">
          <div className="goal-fill" style={{ width: `${goalPct}%` }} />
        </div>
        <div className="row small muted" style={{ justifyContent: "space-between" }}>
          <span>
            Período anterior ({period.prevLabel}): <strong>{brl(prevSalesTotal)}</strong>
          </span>
          <span>
            {goalRemaining > 0
              ? `Faltam ${brl(goalRemaining)} para bater a meta`
              : "Meta superada no período!"}
          </span>
        </div>
      </div>

      {/* 3. Cards de Indicadores com Comparativo, Ticket Médio e Margem */}
      <div className="stats">
        <div className="stat primary">
          <div className="label">Faturamento ({period.label})</div>
          <div className="value">{brl(currSalesTotal)}</div>
          <div className="hint">
            {salesCount} venda(s)
            {salesGrowth !== null && (
              <span className="trend-pill">
                {salesGrowth >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                {salesGrowth >= 0 ? "+" : ""}
                {num(salesGrowth, 1)}%
              </span>
            )}
          </div>
        </div>

        <div className="stat">
          <div className="label">Ticket Médio & Margem</div>
          <div className="value">{brl(ticketMedio)}</div>
          <div className="hint">
            Lucro bruto: <strong>{brl(grossProfit)}</strong> ({num(grossMarginPct, 0)}%)
          </div>
        </div>

        {isAdmin && (
          <>
            <div className="stat success">
              <div className="label">Recebido ({period.label})</div>
              <div className="value">{brl(currRec)}</div>
              <div className="hint">
                a receber: {brl(recOpen._sum.amount)}
                {recGrowth !== null && (
                  <span className="trend-pill">
                    {recGrowth >= 0 ? "+" : ""}
                    {num(recGrowth, 0)}%
                  </span>
                )}
              </div>
            </div>
            <div className="stat danger">
              <div className="label">Pago ({period.label})</div>
              <div className="value">{brl(currDes)}</div>
              <div className="hint">a pagar: {brl(desOpen._sum.amount)}</div>
            </div>
            <div className={`stat ${netPeriod >= 0 ? "success" : "danger"}`}>
              <div className="label">Resultado caixa</div>
              <div className="value">{brl(netPeriod)}</div>
              <div className="hint">{overdueCount} conta(s) vencida(s)</div>
            </div>
          </>
        )}

        <div className="stat">
          <div className="label">Ordens de Serviço</div>
          <div className="value">{openOsCount} na bancada</div>
          <div className="hint">
            {urgentOsCount > 0 ? (
              <span className="bold">{urgentOsCount} urgente(s)/alta(s)</span>
            ) : (
              <Link href="/os">acompanhar OS</Link>
            )}
          </div>
        </div>

        <div className="stat">
          <div className="label">Base Ativa</div>
          <div className="value">{clientCount} clientes</div>
          <div className="hint">{productCount} produtos cadastrados</div>
        </div>
      </div>

      {/* 4. Agenda Financeira (Vencidos & Próximos 7 dias) + Fila de OS na Bancada */}
      <div className="grid grid-2 mb">
        {isAdmin && (
          <div className="card flush">
            <div className="card-header">
              <h2>
                <CalendarClock size={16} /> Agenda Financeira (Vencidos & 7 dias)
              </h2>
              <Link className="small row" style={{ gap: 4 }} href="/financeiro?status=PENDENTE">
                ver financeiro <ArrowRight size={13} />
              </Link>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Vencimento</th>
                    <th>Descrição</th>
                    <th>Tipo</th>
                    <th className="num">Valor</th>
                    <th className="num">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingFinancial.map((e) => {
                    const due = new Date(e.dueDate);
                    const isOverdue = due < today;
                    const isToday = due.getTime() === today.getTime();
                    const boundPay = markPaid.bind(null, e.id, returnUrl);
                    return (
                      <tr key={e.id}>
                        <td>
                          <div className={isOverdue ? "text-danger" : "bold"}>{fmtDate(e.dueDate)}</div>
                          {isOverdue && <span className="badge red">Atrasado</span>}
                          {isToday && <span className="badge yellow">Vence hoje</span>}
                        </td>
                        <td>
                          <Link href={`/financeiro/${e.id}`}>{e.description}</Link>
                          {e.category && <div className="muted small">{e.category}</div>}
                        </td>
                        <td>
                          <StatusBadge status={e.type} />
                        </td>
                        <td className="num bold">{brl(e.amount)}</td>
                        <td className="actions">
                          <form action={boundPay} className="inline-form">
                            <button type="submit" className="btn sm secondary" title="Marcar como pago agora">
                              <Check size={13} /> Baixar
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                  {upcomingFinancial.length === 0 && (
                    <tr>
                      <td colSpan={5} className="empty">
                        <CheckCircle2 size={15} className="icon-inline" /> Nenhuma conta pendente para os próximos 7 dias.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card flush">
          <div className="card-header">
            <h2>
              <Wrench size={16} /> Fila de OS na Bancada ({openOsCount})
            </h2>
            <Link className="small row" style={{ gap: 4 }} href="/os">
              ver todas <ArrowRight size={13} />
            </Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>OS</th>
                  <th>Equipamento / Cliente</th>
                  <th>Prioridade</th>
                  <th>Status</th>
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {sortedActiveOs.map((os) => (
                  <tr key={os.id}>
                    <td className="bold">
                      <Link href={`/os/${os.id}`}>#{os.id}</Link>
                    </td>
                    <td>
                      <Link href={`/os/${os.id}`} className="bold">
                        {os.equipment}
                      </Link>
                      <div className="muted small">
                        {os.client?.name ?? "Cliente avulso"}
                        {os.technician ? ` • Téc: ${os.technician.name.split(" ")[0]}` : ""}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={os.priority} />
                    </td>
                    <td>
                      <StatusBadge status={os.status} />
                    </td>
                    <td className="num bold">{brl(os.total)}</td>
                  </tr>
                ))}
                {sortedActiveOs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">
                      <CheckCircle2 size={15} className="icon-inline" /> Nenhuma Ordem de Serviço pendente na bancada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 5. Gráficos de Evolução Semestral */}
      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h2>
              <TrendingUp size={16} /> Faturamento últimos 6 meses
            </h2>
          </div>
          <BarChart
            labels={months.map(monthLabel)}
            series={[{ label: "Vendas", values: months.map((m) => salesByMonth.get(m) ?? 0) }]}
            format={(v) => brl(v)}
          />
        </div>

        {isAdmin ? (
          <div className="card">
            <div className="card-header">
              <h2>Fluxo de caixa realizado (6 meses)</h2>
            </div>
            <BarChart
              labels={months.map(monthLabel)}
              series={[
                { label: "Receitas", color: "green", values: months.map((m) => recByMonth.get(m) ?? 0) },
                { label: "Despesas", color: "red", values: months.map((m) => desByMonth.get(m) ?? 0) },
              ]}
              format={(v) => brl(v)}
            />
          </div>
        ) : (
          <div className="card">
            <div className="card-header">
              <h2>Produtos mais vendidos ({period.label})</h2>
            </div>
            <HBarList
              rows={topItems.map((t) => ({
                name: prodById.get(t.productId)?.name ?? `Produto #${t.productId}`,
                value: t._sum.total ?? 0,
              }))}
              format={(v) => brl(v)}
            />
          </div>
        )}
      </div>

      {/* 6. Divisão por Forma de Pagamento, Top Clientes e Top Produtos */}
      <div className="grid grid-3 mt">
        <div className="card">
          <div className="card-header">
            <h2>
              <CreditCard size={16} /> Formas de pagamento ({period.label})
            </h2>
          </div>
          <HBarList rows={paymentRows} format={(v) => brl(v)} />
        </div>

        <div className="card">
          <div className="card-header">
            <h2>
              <Users size={16} /> Top clientes ({period.label})
            </h2>
            <Link className="small row" style={{ gap: 4 }} href="/clientes">
              clientes <ArrowRight size={13} />
            </Link>
          </div>
          <HBarList rows={topClientRows} format={(v) => brl(v)} />
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Top 5 produtos ({period.label})</h2>
            <Link className="small row" style={{ gap: 4 }} href="/relatorios">
              relatórios <ArrowRight size={13} />
            </Link>
          </div>
          <HBarList
            rows={topItems.map((t) => ({
              name: prodById.get(t.productId)?.name ?? `Produto #${t.productId}`,
              value: t._sum.total ?? 0,
            }))}
            format={(v) => brl(v)}
          />
        </div>
      </div>

      {/* 7. Últimas Vendas e Alertas de Estoque */}
      <div className="grid grid-2 mt">
        <div className="card flush">
          <div className="card-header">
            <h2>Últimas vendas</h2>
            <Link className="small row" style={{ gap: 4 }} href="/vendas">
              ver todas <ArrowRight size={13} />
            </Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>Pagamento</th>
                  <th className="num">Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((s) => (
                  <tr key={s.id}>
                    <td className="bold">
                      <Link href={`/vendas/${s.id}`}>#{s.id}</Link>
                    </td>
                    <td>{fmtDate(s.date)}</td>
                    <td>{s.client?.name ?? <span className="muted">Consumidor final</span>}</td>
                    <td className="small muted">{s.paymentMethod ?? "—"}</td>
                    <td className="num bold">{brl(s.total)}</td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                  </tr>
                ))}
                {recentSales.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">
                      Nenhuma venda registrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card flush">
          <div className="card-header">
            <h2>
              <AlertTriangle size={16} /> Alertas de estoque mínimo
            </h2>
            <Link className="small row" style={{ gap: 4 }} href="/estoque">
              ir para estoque <ArrowRight size={13} />
            </Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th className="num">Saldo</th>
                  <th className="num">Mínimo</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((p) => (
                  <tr key={Number(p.id)}>
                    <td>
                      <Link href={`/produtos/${p.id}`}>{p.name}</Link>
                      <div className="muted small">{p.sku}</div>
                    </td>
                    <td className="num text-danger bold">
                      {num(p.stock)} {p.unit}
                    </td>
                    <td className="num">{num(p.minStock)}</td>
                  </tr>
                ))}
                {lowStock.length === 0 && (
                  <tr>
                    <td colSpan={3} className="empty">
                      <CheckCircle2 size={15} className="icon-inline" /> Nenhum produto abaixo do estoque mínimo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 8. Feed de Atividade Recente da Equipe */}
      <div className="card flush mt">
        <div className="card-header">
          <h2>
            <Activity size={16} /> Atividade recente da equipe
          </h2>
          {isAdmin && (
            <Link className="small row" style={{ gap: 4 }} href="/auditoria">
              histórico completo <ArrowRight size={13} />
            </Link>
          )}
        </div>
        <div className="activity-list">
          {recentAuditLogs.map((log) => (
            <div key={log.id} className="activity-item">
              <div className="activity-left">
                <span className="activity-dot" />
                <div>
                  <div>
                    <strong>{log.userName}</strong>{" "}
                    <span className="badge gray" style={{ margin: "0 4px" }}>
                      {log.module}
                    </span>{" "}
                    <span>{log.details}</span>
                  </div>
                </div>
              </div>
              <div className="small muted" style={{ whiteSpace: "nowrap" }}>
                {fmtDateTime(log.createdAt)}
              </div>
            </div>
          ))}
          {recentAuditLogs.length === 0 && (
            <div className="empty">Nenhuma atividade registrada recentemente.</div>
          )}
        </div>
      </div>
    </>
  );
}
