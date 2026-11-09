import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { pageParams, spStr } from "@/lib/form";
import { brl, fmtDate } from "@/lib/format";
import { ExportCsvButton, FlashMessages, PageHeader, Pagination, StatusBadge } from "@/components/ui";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ComprasPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = spStr(sp, "q");
  const status = spStr(sp, "status");
  const { page, skip, take, pageSize } = pageParams(sp);

  const where: Prisma.PurchaseWhereInput = {
    ...(q && { OR: [{ supplier: { name: { contains: q } } }, ...(Number(q) ? [{ id: Number(q) }] : [])] }),
    ...(status && { status }),
  };

  const [purchases, total, pending, received] = await Promise.all([
    prisma.purchase.findMany({
      where,
      orderBy: [{ date: "desc" }, { id: "desc" }],
      skip,
      take,
      include: { supplier: true, _count: { select: { items: true } } },
    }),
    prisma.purchase.count({ where }),
    prisma.purchase.aggregate({ where: { status: "PENDENTE" }, _sum: { total: true }, _count: true }),
    prisma.purchase.aggregate({ where: { status: "RECEBIDA" }, _sum: { total: true }, _count: true }),
  ]);

  return (
    <>
      <PageHeader
        title="Compras"
        subtitle="Pedidos de compra a fornecedores"
        actions={
          <>
            <ExportCsvButton entity="compras" />
            <Link className="btn" href="/compras/novo">
              <Plus size={15} /> Nova compra
            </Link>
          </>
        }
      />
      <FlashMessages sp={sp} />

      <div className="stats">
        <div className="stat warning">
          <div className="label">Aguardando recebimento</div>
          <div className="value">{brl(pending._sum.total)}</div>
          <div className="hint">{pending._count} pedido(s)</div>
        </div>
        <div className="stat primary">
          <div className="label">Total recebido</div>
          <div className="value">{brl(received._sum.total)}</div>
          <div className="hint">{received._count} pedido(s)</div>
        </div>
      </div>

      <form className="filters">
        <input className="grow" name="q" placeholder="Buscar por fornecedor ou nº da compra..." defaultValue={q} />
        <select name="status" defaultValue={status}>
          <option value="">Todos os status</option>
          <option value="PENDENTE">Pendente</option>
          <option value="RECEBIDA">Recebida</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
        <button className="btn secondary">Filtrar</button>
      </form>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Data</th>
                <th>Fornecedor</th>
                <th>Vencimento</th>
                <th>Recebida em</th>
                <th className="num">Itens</th>
                <th className="num">Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id}>
                  <td className="bold">
                    <Link href={`/compras/${p.id}`}>#{p.id}</Link>
                  </td>
                  <td>{fmtDate(p.date)}</td>
                  <td>{p.supplier?.name ?? "—"}</td>
                  <td>{fmtDate(p.dueDate)}</td>
                  <td>{p.receivedAt ? new Date(p.receivedAt).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="num">{p._count.items}</td>
                  <td className="num bold">{brl(p.total)}</td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty">
                    Nenhuma compra encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination basePath="/compras" sp={sp} page={page} pageSize={pageSize} total={total} />
      </div>
    </>
  );
}
