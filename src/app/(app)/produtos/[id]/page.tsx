import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fmtDateTime, num } from "@/lib/format";
import { PageHeader, StatusBadge } from "@/components/ui";
import { ActionForm } from "@/components/Forms";
import { saveProduct } from "../actions";

const UNITS = ["UN", "CX", "KG", "G", "L", "ML", "M", "M2", "PC", "PCT", "HR", "SV"];

export default async function ProdutoFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "novo";
  const product = isNew ? null : await prisma.product.findUnique({ where: { id: Number(id) } });
  if (!isNew && !product) notFound();

  const [suppliers, categories, movements] = await Promise.all([
    prisma.supplier.findMany({ where: { OR: [{ active: true }, { id: product?.supplierId ?? -1 }] }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { category: { not: null } }, distinct: ["category"], select: { category: true } }),
    product
      ? prisma.stockMovement.findMany({ where: { productId: product.id }, orderBy: { createdAt: "desc" }, take: 15, include: { user: true } })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title={isNew ? "Novo produto" : product!.name} subtitle={isNew ? "Cadastre um produto ou serviço" : `SKU ${product!.sku}`} />
      <div className="card">
        <ActionForm
          action={saveProduct.bind(null, product?.id ?? null)}
          extraActions={
            <Link className="btn secondary" href="/produtos">
              Cancelar
            </Link>
          }
        >
          <div className="form-grid">
            <div className="field s3">
              <label>Código (SKU) *</label>
              <input name="sku" defaultValue={product?.sku ?? ""} required />
            </div>
            <div className="field s9" style={{ gridColumn: "span 9" }}>
              <label>Nome *</label>
              <input name="name" defaultValue={product?.name ?? ""} required />
            </div>
            <div className="field s4">
              <label>Categoria</label>
              <input name="category" list="categories" defaultValue={product?.category ?? ""} />
              <datalist id="categories">
                {categories.map((c) => (
                  <option key={c.category} value={c.category!} />
                ))}
              </datalist>
            </div>
            <div className="field s2">
              <label>Unidade</label>
              <select name="unit" defaultValue={product?.unit ?? "UN"}>
                {UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Fornecedor principal</label>
              <select name="supplierId" defaultValue={product?.supplierId ?? ""}>
                <option value="">—</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field s3">
              <label>Preço de custo (R$)</label>
              <input name="costPrice" type="number" step="0.01" min="0" defaultValue={product?.costPrice ?? 0} />
            </div>
            <div className="field s3">
              <label>Preço de venda (R$)</label>
              <input name="salePrice" type="number" step="0.01" min="0" defaultValue={product?.salePrice ?? 0} />
            </div>
            <div className="field s3">
              <label>{isNew ? "Estoque inicial" : "Estoque atual"}</label>
              {isNew ? (
                <input name="stock" type="number" step="0.001" min="0" defaultValue={0} />
              ) : (
                <input value={`${num(product!.stock)} ${product!.unit}`} readOnly />
              )}
            </div>
            <div className="field s3">
              <label>Estoque mínimo</label>
              <input name="minStock" type="number" step="0.001" min="0" defaultValue={product?.minStock ?? 0} />
            </div>
            <div className="field s12">
              <label>Descrição</label>
              <textarea name="description" defaultValue={product?.description ?? ""} />
            </div>
            <div className="field s12">
              <label className="checkbox">
                <input type="checkbox" name="active" defaultChecked={product?.active ?? true} /> Produto ativo
              </label>
              {!isNew && (
                <span className="muted small">
                  Para alterar o estoque use a tela <Link href="/estoque">Estoque</Link>, uma compra ou uma venda.
                </span>
              )}
            </div>
          </div>
        </ActionForm>
      </div>

      {product && (
        <div className="card flush">
          <div className="card-header">
            <h2>Últimas movimentações de estoque</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th className="num">Quantidade</th>
                  <th>Motivo</th>
                  <th>Usuário</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>{fmtDateTime(m.createdAt)}</td>
                    <td>
                      <StatusBadge status={m.type} />
                    </td>
                    <td className="num">{num(m.quantity)}</td>
                    <td>{m.reason ?? "—"}</td>
                    <td>{m.user?.name ?? "—"}</td>
                  </tr>
                ))}
                {movements.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">
                      Nenhuma movimentação.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
