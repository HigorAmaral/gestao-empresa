import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus, Printer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { pageParams, spStr } from "@/lib/form";
import { brl, fmtDate } from "@/lib/format";
import { ExportCsvButton, FlashMessages, PageHeader, Pagination, StatusBadge } from "@/components/ui";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function VendasPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = spStr(sp, "q");
  const status = spStr(sp, "status");
  const from = spStr(sp, "from");
  const to = spStr(sp, "to");
  const { page, skip, take, pageSize } = pageParams(sp);

  const where: Prisma.SaleWhereInput = {
    ...(q && {
      OR: [{ client: { name: { contains: q } } }, ...(Number(q) ? [{ id: Number(q) }] : [])],
    }),
    ...(status && { status }),
    ...((from || to) && {
      date: {
        ...(from && { gte: new Date(from + "T00:00:00.000Z") }),
        ...(to && { lte: new Date(to + "T00:00:00.000Z") }),
      },
    }),
  };

  const [sales, total, sum] = await Promise.all([
    prisma.sale.findMany({
      where,
      orderBy: [{ date: "desc" }, { id: "desc" }],
      skip,
      take,
      include: { client: true, user: true, _count: { select: { items: true } } },
    }),
    prisma.sale.count({ where }),
    prisma.sale.aggregate({ where: { ...where, status: "CONFIRMADA" }, _sum: { total: true }, _count: true }),
  ]);

  return (
    <>
      <PageHeader
        title="Vendas"
        subtitle="Orçamentos e pedidos de venda"
        actions={
          <>
            <ExportCsvButton entity="vendas" />
            <Link className="btn" href="/vendas/novo">
              <Plus size={15} /> Nova venda
            </Link>
          </>
        }
      />
      <FlashMessages sp={sp} />

      <div className="stats">
        <div className="stat primary">
          <div className="label">Vendas confirmadas (filtro)</div>
          <div className="value">{brl(sum._sum.total)}</div>
          <div className="hint">{sum._count} venda(s)</div>
        </div>
        <div className="stat">
          <div className="label">Ticket médio</div>
          <div className="value">{brl(sum._count ? (sum._sum.total ?? 0) / sum._count : 0)}</div>
        </div>
      </div>

      <form className="filters">
        <input className="grow" name="q" placeholder="Buscar por cliente ou nº da venda..." defaultValue={q} />
        <select name="status" defaultValue={status}>
          <option value="">Todos os status</option>
          <option value="ORCAMENTO">Orçamento</option>
          <option value="CONFIRMADA">Confirmada</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
        <input type="date" name="from" defaultValue={from} title="De" />
        <input type="date" name="to" defaultValue={to} title="Até" />
        <button className="btn secondary">Filtrar</button>
      </form>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Data</th>
                <th>Cliente</th>
                <th>Vendedor</th>
                <th>Pagamento</th>
                <th className="num">Itens</th>
                <th className="num">Total</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id}>
                  <td className="bold">
                    <Link href={`/vendas/${s.id}`}>#{s.id}</Link>
                  </td>
                  <td>{fmtDate(s.date)}</td>
                  <td>{s.client?.name ?? <span className="muted">Consumidor final</span>}</td>
                  <td>{s.user?.name ?? "—"}</td>
                  <td>{s.paymentMethod ?? "—"}</td>
                  <td className="num">{s._count.items}</td>
                  <td className="num bold">{brl(s.total)}</td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="actions">
                    <Link className="btn sm secondary" href={`/vendas/${s.id}/recibo`} title="Recibo / Pedido imprimível">
                      <Printer size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty">
                    Nenhuma venda encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination basePath="/vendas" sp={sp} page={page} pageSize={pageSize} total={total} />
      </div>
    </>
  );
}
