import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { pageParams, spStr } from "@/lib/form";
import { ActiveBadge, ExportCsvButton, FlashMessages, PageHeader, Pagination } from "@/components/ui";
import { ConfirmButton } from "@/components/Forms";
import { deleteClient } from "./actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ClientesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = spStr(sp, "q");
  const status = spStr(sp, "status");
  const { page, skip, take, pageSize } = pageParams(sp);

  const where: Prisma.ClientWhereInput = {
    ...(q && {
      OR: [{ name: { contains: q } }, { document: { contains: q } }, { email: { contains: q } }, { city: { contains: q } }],
    }),
    ...(status === "ativos" && { active: true }),
    ...(status === "inativos" && { active: false }),
  };

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take,
      include: { _count: { select: { sales: true } } },
    }),
    prisma.client.count({ where }),
  ]);

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Cadastro e gestão de clientes"
        actions={
          <>
            <ExportCsvButton entity="clientes" />
            <Link className="btn" href="/clientes/novo">
              <Plus size={15} /> Novo cliente
            </Link>
          </>
        }
      />
      <FlashMessages sp={sp} />

      <form className="filters">
        <input className="grow" name="q" placeholder="Buscar por nome, documento, e-mail ou cidade..." defaultValue={q} />
        <select name="status" defaultValue={status}>
          <option value="">Todos</option>
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
        </select>
        <button className="btn secondary">Filtrar</button>
      </form>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Documento</th>
                <th>Contato</th>
                <th>Cidade/UF</th>
                <th className="num">Vendas</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="bold">
                    <Link href={`/clientes/${c.id}`}>{c.name}</Link>
                  </td>
                  <td>{c.document ?? "—"}</td>
                  <td>
                    <div>{c.email ?? "—"}</div>
                    <div className="muted small">{c.phone}</div>
                  </td>
                  <td>{[c.city, c.state].filter(Boolean).join("/") || "—"}</td>
                  <td className="num">{c._count.sales}</td>
                  <td>
                    <ActiveBadge active={c.active} />
                  </td>
                  <td className="actions">
                    <Link className="btn sm secondary" href={`/clientes/${c.id}`}>
                      Editar
                    </Link>
                    <ConfirmButton
                      action={deleteClient.bind(null, c.id)}
                      label="Excluir"
                      className="btn sm danger"
                      confirmText={`Excluir o cliente "${c.name}"?`}
                    />
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination basePath="/clientes" sp={sp} page={page} pageSize={pageSize} total={total} />
      </div>
    </>
  );
}
