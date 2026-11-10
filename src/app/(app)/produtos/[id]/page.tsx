import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin } from "lucide-react";
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

  const [suppliers, categories, movements, stockLocations] = await Promise.all([
    prisma.supplier.findMany({ where: { OR: [{ active: true }, { id: product?.supplierId ?? -1 }] }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { category: { not: null } }, distinct: ["category"], select: { category: true } }),
    product
      ? prisma.stockMovement.findMany({ where: { productId: product.id }, orderBy: { createdAt: "desc" }, take: 15, include: { user: true } })
      : Promise.resolve([]),
    product
      ? prisma.productStockLocation.findMany({
          where: { productId: product.id },
          include: { location: true },
          orderBy: { location: { code: "asc" } },
        })
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
        <div className="card flush mb" style={{ marginBottom: 20 }}>
          <div
            className="card-header"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <h2>
              <MapPin size={16} /> Endereçamento no Estoque
            </h2>
            <Link
              className="btn sm secondary"
              href={`/estoque/enderecamento?productId=${product.id}&view=produtos`}
            >
              Gerenciar Endereços <ArrowRight size={13} />
            </Link>
          </div>

          <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13 }}>
            <div>
              <span className="muted">Saldo Físico Total:</span>{" "}
              <strong>{num(product.stock)} {product.unit}</strong>
            </div>
            <div>
              <span className="muted">Total Endereçado:</span>{" "}
              <strong>
                {num(stockLocations.reduce((s, it) => s + it.quantity, 0))} {product.unit}
              </strong>
            </div>
            <div>
              <span className="muted">Pendente de Alocação:</span>{" "}
              <strong className={product.stock > stockLocations.reduce((s, it) => s + it.quantity, 0) ? "text-danger" : ""}>
                {num(Math.max(0, product.stock - stockLocations.reduce((s, it) => s + it.quantity, 0)))} {product.unit}
              </strong>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código do Endereço</th>
                  <th>Localização (Corredor / Estante / Nível / Vão)</th>
                  <th className="num">Quantidade Armazenada</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {stockLocations.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="location-tag highlight">{item.location.code}</span>
                    </td>
                    <td>
                      {[item.location.aisle, item.location.rack, item.location.shelf, item.location.bin]
                        .filter(Boolean)
                        .join(" • ") || "—"}
                    </td>
                    <td className="num bold">
                      {num(item.quantity)} {product.unit}
                    </td>
                    <td className="muted small">{item.notes ?? "—"}</td>
                  </tr>
                ))}
                {stockLocations.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty">
                      Este produto ainda não possui nenhum endereço de estoque registrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
