import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Plus, Wrench } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { brl, fmtDate, monthKey, monthLabel, num, todayUTC } from "@/lib/format";
import { BarChart, FlashMessages, HBarList, PageHeader, StatusBadge } from "@/components/ui";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardPage({ searchParams }: { searchParams: SP }) {
  const session = await requireUser();
  const sp = await searchParams;
  const isAdmin = session.role === "ADMIN";
  const today = todayUTC();
  const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  const sixMonthsAgo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1));

  const [
    salesMonth,
    recMonth,
    desMonth,
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
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { status: "CONFIRMADA", date: { gte: startOfMonth, lt: nextMonth } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.financialEntry.aggregate({
      where: { type: "RECEITA", status: "PAGO", dueDate: { gte: startOfMonth, lt: nextMonth } },
      _sum: { amount: true },
    }),
    prisma.financialEntry.aggregate({
      where: { type: "DESPESA", status: "PAGO", dueDate: { gte: startOfMonth, lt: nextMonth } },
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
      SELECT id, sku, name, stock, minStock, unit FROM Product WHERE active = 1 AND stock <= minStock ORDER BY (stock - minStock) ASC LIMIT 6`,
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
      where: { sale: { status: "CONFIRMADA" } },
      _sum: { total: true, quantity: true },
      orderBy: { _sum: { total: "desc" } },
      take: 5,
    }),
  ]);

  const topProductIds = topItems.map((t) => t.productId);
  const topProducts = topProductIds.length
    ? await prisma.product.findMany({ where: { id: { in: topProductIds } } })
    : [];
  const prodById = new Map(topProducts.map((p) => [p.id, p]));

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

  const netMonth = (recMonth._sum.amount ?? 0) - (desMonth._sum.amount ?? 0);

  return (
    <>
      <PageHeader
        title={`Olá, ${session.name.split(" ")[0]}`}
        subtitle="Visão geral do desempenho da empresa"
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

      <div className="stats">
        <div className="stat primary">
          <div className="label">Faturamento no mês</div>
          <div className="value">{brl(salesMonth._sum.total)}</div>
          <div className="hint">{salesMonth._count} venda(s) confirmada(s)</div>
        </div>
        {isAdmin && (
          <>
            <div className="stat success">
              <div className="label">Recebido no mês</div>
              <div className="value">{brl(recMonth._sum.amount)}</div>
              <div className="hint">a receber: {brl(recOpen._sum.amount)}</div>
            </div>
            <div className="stat danger">
              <div className="label">Pago no mês</div>
              <div className="value">{brl(desMonth._sum.amount)}</div>
              <div className="hint">a pagar: {brl(desOpen._sum.amount)}</div>
            </div>
            <div className={`stat ${netMonth >= 0 ? "success" : "danger"}`}>
              <div className="label">Resultado caixa (mês)</div>
              <div className="value">{brl(netMonth)}</div>
              <div className="hint">{overdueCount} conta(s) vencida(s)</div>
            </div>
          </>
        )}
        <div className="stat">
          <div className="label">Ordens de Serviço</div>
          <div className="value">{openOsCount} em aberto</div>
          <div className="hint">
            <Link href="/os">acompanhar OS</Link>
          </div>
        </div>
        <div className="stat">
          <div className="label">Cadastros ativos</div>
          <div className="value">{clientCount} clientes</div>
          <div className="hint">{productCount} produtos ativos</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h2>Faturamento últimos 6 meses</h2>
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
              <h2>Produtos mais vendidos</h2>
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
                    <td className="num bold">{brl(s.total)}</td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                  </tr>
                ))}
                {recentSales.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">
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
              <AlertTriangle size={16} /> Alertas de estoque
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

      {isAdmin && (
        <div className="card mt">
          <div className="card-header">
            <h2>Top 5 produtos por faturamento</h2>
            <Link className="small row" style={{ gap: 4 }} href="/relatorios">
              relatórios completos <ArrowRight size={13} />
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
      )}
    </>
  );
}
