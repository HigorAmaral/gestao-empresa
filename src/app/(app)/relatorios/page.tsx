import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { spStr } from "@/lib/form";
import { brl, num, todayInput } from "@/lib/format";
import { HBarList, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function RelatoriosPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const today = todayInput();
  const firstDayOfYear = `${today.slice(0, 4)}-01-01`;
  const from = spStr(sp, "from") || firstDayOfYear;
  const to = spStr(sp, "to") || today;

  const dateRange = {
    gte: new Date(from + "T00:00:00.000Z"),
    lte: new Date(to + "T23:59:59.999Z"),
  };

  const [sales, saleItems, entries, purchases] = await Promise.all([
    prisma.sale.findMany({
      where: { status: "CONFIRMADA", date: dateRange },
      include: { client: true, user: true },
    }),
    prisma.saleItem.findMany({
      where: { sale: { status: "CONFIRMADA", date: dateRange } },
      include: { product: true },
    }),
    prisma.financialEntry.findMany({
      where: { status: "PAGO", dueDate: dateRange },
    }),
    prisma.purchase.aggregate({
      where: { status: "RECEBIDA", date: dateRange },
      _sum: { total: true },
      _count: true,
    }),
  ]);

  const grossRevenue = sales.reduce((s, v) => s + v.subtotal, 0);
  const discounts = sales.reduce((s, v) => s + v.discount, 0);
  const netSales = sales.reduce((s, v) => s + v.total, 0);
  const cogs = saleItems.reduce((s, it) => s + it.quantity * it.product.costPrice, 0);
  const grossProfit = netSales - cogs;

  const expByCat = new Map<string, number>();
  let otherIncome = 0;
  for (const e of entries) {
    if (e.type === "RECEITA" && !e.saleId) otherIncome += e.amount;
    if (e.type === "DESPESA" && !e.purchaseId) {
      const cat = e.category || "Outras despesas";
      expByCat.set(cat, (expByCat.get(cat) ?? 0) + e.amount);
    }
  }
  const operatingExpenses = [...expByCat.values()].reduce((s, v) => s + v, 0);
  const netProfit = grossProfit + otherIncome - operatingExpenses;

  // Agrupamentos
  const byProduct = new Map<string, { qty: number; revenue: number; profit: number }>();
  for (const it of saleItems) {
    const key = `${it.product.sku} — ${it.product.name}`;
    const cur = byProduct.get(key) ?? { qty: 0, revenue: 0, profit: 0 };
    cur.qty += it.quantity;
    cur.revenue += it.total;
    cur.profit += it.total - it.quantity * it.product.costPrice;
    byProduct.set(key, cur);
  }
  const topProducts = [...byProduct.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const byClient = new Map<string, { count: number; total: number }>();
  const byPayment = new Map<string, number>();
  const bySeller = new Map<string, number>();
  for (const s of sales) {
    const cName = s.client?.name ?? "Consumidor final";
    const c = byClient.get(cName) ?? { count: 0, total: 0 };
    c.count += 1;
    c.total += s.total;
    byClient.set(cName, c);

    const pm = s.paymentMethod || "Não informado";
    byPayment.set(pm, (byPayment.get(pm) ?? 0) + s.total);

    const uName = s.user?.name || "Não informado";
    bySeller.set(uName, (bySeller.get(uName) ?? 0) + s.total);
  }
  const topClients = [...byClient.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return (
    <>
      <PageHeader
        title="Relatórios Gerenciais"
        subtitle={`Demonstrativo de resultados e análises de ${new Date(from + "T00:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" })} até ${new Date(to + "T00:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" })}`}
        actions={<PrintButton />}
      />

      <form className="filters">
        <div className="field">
          <label>De</label>
          <input type="date" name="from" defaultValue={from} />
        </div>
        <div className="field">
          <label>Até</label>
          <input type="date" name="to" defaultValue={to} />
        </div>
        <button className="btn">Atualizar período</button>
      </form>

      <div className="stats">
        <div className="stat primary">
          <div className="label">Receita líquida de vendas</div>
          <div className="value">{brl(netSales)}</div>
          <div className="hint">{sales.length} venda(s)</div>
        </div>
        <div className="stat">
          <div className="label">Lucro bruto</div>
          <div className="value">{brl(grossProfit)}</div>
          <div className="hint">margem {num(netSales ? (grossProfit / netSales) * 100 : 0, 1)}%</div>
        </div>
        <div className="stat danger">
          <div className="label">Despesas operacionais pagas</div>
          <div className="value">{brl(operatingExpenses)}</div>
          <div className="hint">compras recebidas: {brl(purchases._sum.total)}</div>
        </div>
        <div className={`stat ${netProfit >= 0 ? "success" : "danger"}`}>
          <div className="label">Resultado líquido</div>
          <div className="value">{brl(netProfit)}</div>
          <div className="hint">margem líq. {num(netSales ? (netProfit / netSales) * 100 : 0, 1)}%</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card flush">
          <div className="card-header">
            <h2>DRE Simplificado</h2>
          </div>
          <table>
            <tbody>
              <tr>
                <td>(+) Receita bruta de vendas</td>
                <td className="num">{brl(grossRevenue)}</td>
              </tr>
              <tr>
                <td>(−) Descontos concedidos</td>
                <td className="num text-danger">− {brl(discounts)}</td>
              </tr>
              <tr className="bold">
                <td>(=) Receita líquida de vendas</td>
                <td className="num">{brl(netSales)}</td>
              </tr>
              <tr>
                <td>(−) Custo das mercadorias vendidas (CMV)</td>
                <td className="num text-danger">− {brl(cogs)}</td>
              </tr>
              <tr className="bold">
                <td>(=) Lucro bruto</td>
                <td className="num">{brl(grossProfit)}</td>
              </tr>
              {otherIncome > 0 && (
                <tr>
                  <td>(+) Outras receitas recebidas</td>
                  <td className="num text-success">{brl(otherIncome)}</td>
                </tr>
              )}
              {[...expByCat.entries()].map(([cat, val]) => (
                <tr key={cat}>
                  <td className="muted">(−) Despesa: {cat}</td>
                  <td className="num text-danger">− {brl(val)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>(=) Resultado líquido do período</td>
                <td className={`num ${netProfit >= 0 ? "text-success" : "text-danger"}`}>{brl(netProfit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Vendas por forma de pagamento</h2>
          </div>
          <HBarList
            rows={[...byPayment.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)}
            format={(v) => brl(v)}
          />
          <div className="card-header mt">
            <h2>Vendas por vendedor</h2>
          </div>
          <HBarList
            rows={[...bySeller.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)}
            format={(v) => brl(v)}
          />
        </div>
      </div>

      <div className="grid grid-2 mt">
        <div className="card flush">
          <div className="card-header">
            <h2>Top produtos vendidos</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th className="num">Qtd.</th>
                  <th className="num">Faturamento</th>
                  <th className="num">Lucro bruto</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td className="num">{num(p.qty)}</td>
                    <td className="num">{brl(p.revenue)}</td>
                    <td className="num text-success">{brl(p.profit)}</td>
                  </tr>
                ))}
                {topProducts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty">
                      Sem vendas no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card flush">
          <div className="card-header">
            <h2>Top clientes</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th className="num">Compras</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {topClients.map((c) => (
                  <tr key={c.name}>
                    <td>{c.name}</td>
                    <td className="num">{c.count}</td>
                    <td className="num bold">{brl(c.total)}</td>
                  </tr>
                ))}
                {topClients.length === 0 && (
                  <tr>
                    <td colSpan={3} className="empty">
                      Sem vendas no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
