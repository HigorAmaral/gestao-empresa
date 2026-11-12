import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Layers, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { pageParams, spStr } from "@/lib/form";
import { brl, fmtDateTime, num } from "@/lib/format";
import { PageHeader, Pagination, StatusBadge } from "@/components/ui";
import { ActionForm } from "@/components/Forms";
import { createMovement } from "./actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function EstoquePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const type = spStr(sp, "type");
  const productId = Number(spStr(sp, "productId")) || undefined;
  const { page, skip, take, pageSize } = pageParams(sp);

  const where: Prisma.StockMovementWhereInput = {
    ...(type && { type }),
    ...(productId && { productId }),
  };

  const [products, movements, total, lowStock] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.stockMovement.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { product: true, user: true } }),
    prisma.stockMovement.count({ where }),
    prisma.$queryRaw<{ id: number; sku: string; name: string; stock: number; minStock: number; unit: string }[]>`
      SELECT id, sku, name, stock, "minStock", unit FROM "Product" WHERE active = true AND stock <= "minStock" ORDER BY (stock - "minStock") ASC LIMIT 10`,
  ]);

  const costValue = products.reduce((s, p) => s + p.stock * p.costPrice, 0);
  const saleValue = products.reduce((s, p) => s + p.stock * p.salePrice, 0);
  const totalItems = products.reduce((s, p) => s + p.stock, 0);

  return (
    <>
      <PageHeader
        title="Estoque"
        subtitle="Saldos, movimentações, endereçamento WMS e balanço de inventário"
        actions={
          <Link className="btn" href="/estoque/inventario">
            <ClipboardCheck size={15} /> Inventário / Contagem Cega
          </Link>
        }
      />

      <div className="subnav-tabs">
        <Link className="subnav-tab active" href="/estoque">
          <Layers size={14} /> Movimentações & Saldo
        </Link>
        <Link className="subnav-tab" href="/estoque/enderecamento">
          <MapPin size={14} /> Endereçamento & Localização
        </Link>
        <Link className="subnav-tab" href="/estoque/inventario">
          <ClipboardCheck size={14} /> Inventário & Balanço Físico
        </Link>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="label">Produtos ativos</div>
          <div className="value">{products.length}</div>
          <div className="hint">{num(totalItems)} itens em estoque</div>
        </div>
        <div className="stat primary">
          <div className="label">Valor em estoque (custo)</div>
          <div className="value">{brl(costValue)}</div>
        </div>
        <div className="stat success">
          <div className="label">Valor em estoque (venda)</div>
          <div className="value">{brl(saleValue)}</div>
        </div>
        <div className={`stat ${lowStock.length ? "danger" : ""}`}>
          <div className="label">Abaixo do mínimo</div>
          <div className="value">{lowStock.length}</div>
          <div className="hint">
            <Link href="/produtos?filter=baixo">ver todos</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h2>Nova movimentação manual</h2>
          </div>
          <ActionForm action={createMovement} submitLabel="Registrar" resetOnSuccess>
            <div className="form-grid">
              <div className="field s12">
                <label>Produto *</label>
                <select name="productId" required defaultValue="">
                  <option value="" disabled>
                    Selecione...
                  </option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name} (saldo: {num(p.stock)} {p.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Tipo *</label>
                <select name="type" defaultValue="ENTRADA">
                  <option value="ENTRADA">Entrada (+)</option>
                  <option value="SAIDA">Saída (−)</option>
                  <option value="AJUSTE">Ajuste de inventário (= saldo)</option>
                </select>
              </div>
              <div className="field">
                <label>Quantidade *</label>
                <input name="quantity" type="number" step="0.001" min="0" required />
              </div>
              <div className="field s12">
                <label>Motivo</label>
                <input name="reason" placeholder="Ex.: perda, devolução, inventário mensal..." />
              </div>
            </div>
          </ActionForm>
        </div>

        <div className="card flush">
          <div className="card-header">
            <h2>
              <AlertTriangle size={16} /> Produtos com estoque baixo
            </h2>
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
                      <CheckCircle2 size={15} className="icon-inline" /> Todos os produtos estão acima do mínimo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card flush mt">
        <div className="card-header">
          <h2>Histórico de movimentações</h2>
        </div>
        <form className="filters" style={{ padding: "12px 20px 0" }}>
          <select name="productId" defaultValue={productId ?? ""}>
            <option value="">Todos os produtos</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select name="type" defaultValue={type}>
            <option value="">Todos os tipos</option>
            <option value="ENTRADA">Entradas</option>
            <option value="SAIDA">Saídas</option>
            <option value="AJUSTE">Ajustes</option>
          </select>
          <button className="btn secondary">Filtrar</button>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Produto</th>
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
                    <Link href={`/produtos/${m.productId}`}>{m.product.name}</Link>
                  </td>
                  <td>
                    <StatusBadge status={m.type} />
                  </td>
                  <td className="num">
                    {m.type === "SAIDA" ? "−" : m.type === "ENTRADA" ? "+" : m.quantity > 0 ? "+" : ""}
                    {num(m.quantity)}
                  </td>
                  <td>{m.reason ?? "—"}</td>
                  <td>{m.user?.name ?? "—"}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    Nenhuma movimentação encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination basePath="/estoque" sp={sp} page={page} pageSize={pageSize} total={total} />
      </div>
    </>
  );
}
