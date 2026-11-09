import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus, Printer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { pageParams, spStr } from "@/lib/form";
import { brl, fmtDate } from "@/lib/format";
import { ExportCsvButton, FlashMessages, PageHeader, Pagination, StatusBadge } from "@/components/ui";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ServiceOrdersPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = spStr(sp, "q");
  const status = spStr(sp, "status");
  const priority = spStr(sp, "priority");
  const { page, skip, take, pageSize } = pageParams(sp);

  const where: Prisma.ServiceOrderWhereInput = {
    ...(q && {
      OR: [
        { equipment: { contains: q } },
        { serialNumber: { contains: q } },
        { client: { name: { contains: q } } },
        ...(Number(q) ? [{ id: Number(q) }] : []),
      ],
    }),
    ...(status && { status }),
    ...(priority && { priority }),
  };

  const [orders, total, openCount, doneStats] = await Promise.all([
    prisma.serviceOrder.findMany({
      where,
      orderBy: [{ openedAt: "desc" }, { id: "desc" }],
      skip,
      take,
      include: { client: true, technician: true },
    }),
    prisma.serviceOrder.count({ where }),
    prisma.serviceOrder.count({ where: { status: { in: ["ABERTA", "EM_ANDAMENTO", "AGUARDANDO_PECA"] } } }),
    prisma.serviceOrder.aggregate({ where: { status: "CONCLUIDA" }, _sum: { total: true }, _count: true }),
  ]);

  return (
    <>
      <PageHeader
        title="Ordens de Serviço"
        subtitle="Controle de assistência técnica, manutenções, laudos e peças"
        actions={
          <>
            <ExportCsvButton entity="os" />
            <Link className="btn" href="/os/novo">
              <Plus size={16} /> Nova OS
            </Link>
          </>
        }
      />
      <FlashMessages sp={sp} />

      <div className="stats">
        <div className="stat warning">
          <div className="label">OS em aberto / andamento</div>
          <div className="value">{openCount}</div>
          <div className="hint">aguardando conclusão</div>
        </div>
        <div className="stat primary">
          <div className="label">Total faturado em OS</div>
          <div className="value">{brl(doneStats._sum.total)}</div>
          <div className="hint">{doneStats._count} OS concluída(s)</div>
        </div>
      </div>

      <form className="filters">
        <input className="grow" name="q" placeholder="Buscar por nº, cliente, equipamento ou nº de série..." defaultValue={q} />
        <select name="status" defaultValue={status}>
          <option value="">Todos os status</option>
          <option value="ABERTA">Aberta</option>
          <option value="EM_ANDAMENTO">Em andamento</option>
          <option value="AGUARDANDO_PECA">Aguardando peça</option>
          <option value="CONCLUIDA">Concluída</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
        <select name="priority" defaultValue={priority}>
          <option value="">Todas as prioridades</option>
          <option value="BAIXA">Baixa</option>
          <option value="NORMAL">Normal</option>
          <option value="ALTA">Alta</option>
          <option value="URGENTE">Urgente</option>
        </select>
        <button className="btn secondary">Filtrar</button>
      </form>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>OS</th>
                <th>Abertura</th>
                <th>Cliente</th>
                <th>Equipamento / Serviço</th>
                <th>Técnico</th>
                <th>Prioridade</th>
                <th>Status</th>
                <th className="num">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((os) => (
                <tr key={os.id}>
                  <td className="bold">
                    <Link href={`/os/${os.id}`}>#{os.id}</Link>
                  </td>
                  <td>{fmtDate(os.openedAt)}</td>
                  <td>{os.client?.name ?? <span className="muted">Avulso</span>}</td>
                  <td>
                    <div className="bold">{os.equipment}</div>
                    {os.serialNumber && <div className="muted small">S/N: {os.serialNumber}</div>}
                  </td>
                  <td>{os.technician?.name ?? "—"}</td>
                  <td>
                    <StatusBadge status={os.priority} />
                  </td>
                  <td>
                    <StatusBadge status={os.status} />
                  </td>
                  <td className="num bold">{brl(os.total)}</td>
                  <td className="actions">
                    <Link className="btn sm secondary" href={`/os/${os.id}/recibo`} title="Imprimir comprovante">
                      <Printer size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty">
                    Nenhuma Ordem de Serviço encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination basePath="/os" sp={sp} page={page} pageSize={pageSize} total={total} />
      </div>
    </>
  );
}
