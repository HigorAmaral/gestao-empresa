import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { AlertTriangle, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { pageParams, spStr } from "@/lib/form";
import { brl, num } from "@/lib/format";
import { ActiveBadge, ExportCsvButton, FlashMessages, PageHeader, Pagination } from "@/components/ui";
import { ConfirmButton } from "@/components/Forms";
import { deleteProduct } from "./actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ProdutosPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = spStr(sp, "q");
  const category = spStr(sp, "category");
  const filter = spStr(sp, "filter");
  const { page, skip, take, pageSize } = pageParams(sp);

  let lowIds: number[] | null = null;
  if (filter === "baixo") {
    const rows = await prisma.$queryRaw<{ id: number }[]>`SELECT id FROM "Product" WHERE stock <= "minStock" AND active = true`;
    lowIds = rows.map((r) => Number(r.id));
  }

  const where: Prisma.ProductWhereInput = {
    ...(q && { OR: [{ name: { contains: q } }, { sku: { contains: q } }, { description: { contains: q } }] }),
    ...(category && { category }),
    ...(filter === "ativos" && { active: true }),
    ...(filter === "inativos" && { active: false }),
    ...(lowIds && { id: { in: lowIds } }),
  };

  const [products, total, categories] = await Promise.all([
    prisma.product.findMany({ where, orderBy: { name: "asc" }, skip, take, include: { supplier: true } }),
    prisma.product.count({ where }),
    prisma.product.findMany({
      where: { category: { not: null } },
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Produtos"
        subtitle="Catálogo de produtos e serviços"
        actions={
          <>
            <ExportCsvButton entity="produtos" />
            <Link className="btn" href="/produtos/novo">
              <Plus size={15} /> Novo produto
            </Link>
          </>
        }
      />
      <FlashMessages sp={sp} />

      <form className="filters">
        <input className="grow" name="q" placeholder="Buscar por nome, SKU ou descrição..." defaultValue={q} />
        <select name="category" defaultValue={category}>
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.category} value={c.category!}>
              {c.category}
            </option>
          ))}
        </select>
        <select name="filter" defaultValue={filter}>
          <option value="">Todos</option>
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
          <option value="baixo">Estoque abaixo do mínimo</option>
        </select>
        <button className="btn secondary">Filtrar</button>
      </form>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Fornecedor</th>
                <th className="num">Custo</th>
                <th className="num">Venda</th>
                <th className="num">Margem</th>
                <th className="num">Estoque</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const margin = p.salePrice > 0 ? ((p.salePrice - p.costPrice) / p.salePrice) * 100 : 0;
                const low = p.stock <= p.minStock;
                return (
                  <tr key={p.id}>
                    <td className="muted">{p.sku}</td>
                    <td className="bold">
                      <Link href={`/produtos/${p.id}`}>{p.name}</Link>
                    </td>
                    <td>{p.category ?? "—"}</td>
                    <td>{p.supplier?.name ?? "—"}</td>
                    <td className="num">{brl(p.costPrice)}</td>
                    <td className="num">{brl(p.salePrice)}</td>
                    <td className={`num ${margin < 0 ? "text-danger" : ""}`}>{num(margin, 1)}%</td>
                    <td className={`num ${low ? "text-danger bold" : ""}`} title={`Mínimo: ${num(p.minStock)}`}>
                      {num(p.stock)} {p.unit} {low && <AlertTriangle size={13} className="icon-inline" />}
                    </td>
                    <td>
                      <ActiveBadge active={p.active} />
                    </td>
                    <td className="actions">
                      <Link className="btn sm secondary" href={`/produtos/${p.id}`}>
                        Editar
                      </Link>
                      <ConfirmButton
                        action={deleteProduct.bind(null, p.id)}
                        label="Excluir"
                        className="btn sm danger"
                        confirmText={`Excluir o produto "${p.name}"?`}
                      />
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={10} className="empty">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination basePath="/produtos" sp={sp} page={page} pageSize={pageSize} total={total} />
      </div>
    </>
  );
}
