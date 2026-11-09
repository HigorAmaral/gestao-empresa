import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { pageParams, spStr } from "@/lib/form";
import { ActiveBadge, ExportCsvButton, FlashMessages, PageHeader, Pagination } from "@/components/ui";
import { ConfirmButton } from "@/components/Forms";
import { deleteSupplier } from "./actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function FornecedoresPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = spStr(sp, "q");
  const status = spStr(sp, "status");
  const { page, skip, take, pageSize } = pageParams(sp);

  const where: Prisma.SupplierWhereInput = {
    ...(q && {
      OR: [{ name: { contains: q } }, { document: { contains: q } }, { email: { contains: q } }, { city: { contains: q } }],
    }),
    ...(status === "ativos" && { active: true }),
    ...(status === "inativos" && { active: false }),
  };

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take,
      include: { _count: { select: { products: true, purchases: true } } },
    }),
    prisma.supplier.count({ where }),
  ]);

  return (
    <>
      <PageHeader
        title="Fornecedores"
        subtitle="Cadastro de fornecedores e parceiros"
        actions={
          <>
            <ExportCsvButton entity="fornecedores" />
            <Link className="btn" href="/fornecedores/novo">
              <Plus size={15} /> Novo fornecedor
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
                <th className="num">Produtos</th>
                <th className="num">Compras</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td className="bold">
                    <Link href={`/fornecedores/${s.id}`}>{s.name}</Link>
                  </td>
                  <td>{s.document ?? "—"}</td>
                  <td>
                    <div>{s.email ?? "—"}</div>
                    <div className="muted small">{s.phone}</div>
                  </td>
                  <td>{[s.city, s.state].filter(Boolean).join("/") || "—"}</td>
                  <td className="num">{s._count.products}</td>
                  <td className="num">{s._count.purchases}</td>
                  <td>
                    <ActiveBadge active={s.active} />
                  </td>
                  <td className="actions">
                    <Link className="btn sm secondary" href={`/fornecedores/${s.id}`}>
                      Editar
                    </Link>
                    <ConfirmButton
                      action={deleteSupplier.bind(null, s.id)}
                      label="Excluir"
                      className="btn sm danger"
                      confirmText={`Excluir o fornecedor "${s.name}"?`}
                    />
                  </td>
                </tr>
              ))}
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty">
                    Nenhum fornecedor encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination basePath="/fornecedores" sp={sp} page={page} pageSize={pageSize} total={total} />
      </div>
    </>
  );
}
