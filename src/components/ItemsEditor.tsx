"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

export type EditorProduct = { id: number; sku: string; name: string; unit: string; price: number; stock: number };
export type EditorItem = { productId: number; quantity: number; price: number };

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Editor de itens de venda/compra/OS. Serializa os itens em um <input type="hidden" name="items"> (JSON).
 */
export function ItemsEditor({
  products,
  initialItems = [],
  initialDiscount = 0,
  initialLaborCost = 0,
  priceLabel = "Preço unit.",
  showDiscount = false,
  showLaborCost = false,
  checkStock = false,
  allowEmpty = false,
  readOnly = false,
}: {
  products: EditorProduct[];
  initialItems?: EditorItem[];
  initialDiscount?: number;
  initialLaborCost?: number;
  priceLabel?: string;
  showDiscount?: boolean;
  showLaborCost?: boolean;
  checkStock?: boolean;
  allowEmpty?: boolean;
  readOnly?: boolean;
}) {
  const [items, setItems] = useState<EditorItem[]>(initialItems);
  const [discount, setDiscount] = useState<number>(initialDiscount);
  const [laborCost, setLaborCost] = useState<number>(initialLaborCost);
  const [selected, setSelected] = useState<string>("");

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const subtotal = items.reduce((s, i) => s + i.quantity * i.price, 0);
  const total = Math.max(0, subtotal + (showLaborCost ? laborCost : 0) - (showDiscount ? discount : 0));

  function add() {
    const id = Number(selected);
    const p = byId.get(id);
    if (!p) return;
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === id);
      if (existing) return prev.map((i) => (i.productId === id ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { productId: id, quantity: 1, price: p.price }];
    });
    setSelected("");
  }

  function update(idx: number, patch: Partial<EditorItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  return (
    <div>
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      {showDiscount && <input type="hidden" name="discount" value={discount} />}
      {showLaborCost && <input type="hidden" name="laborCost" value={laborCost} />}

      {!readOnly && (
        <div className="row mb">
          <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ flex: 1, minWidth: "min(100%, 260px)" }}>
            <option value="">
              {allowEmpty ? "Adicionar peça / produto utilizado (opcional)..." : "Selecione um produto para adicionar..."}
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} — {p.name} ({fmt(p.price)}){checkStock ? ` · estoque: ${p.stock} ${p.unit}` : ""}
              </option>
            ))}
          </select>
          <button type="button" className="btn secondary" onClick={add} disabled={!selected}>
            <Plus size={15} /> Adicionar
          </button>
        </div>
      )}

      <div className="table-wrap" style={{ border: "1px solid var(--border)", borderRadius: 6 }}>
        <table>
          <thead>
            <tr>
              <th>Produto / Peça</th>
              <th className="num" style={{ width: 130 }}>
                Qtd.
              </th>
              <th className="num" style={{ width: 150 }}>
                {priceLabel}
              </th>
              <th className="num" style={{ width: 140 }}>
                Total
              </th>
              {!readOnly && <th style={{ width: 60 }}></th>}
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => {
              const p = byId.get(it.productId);
              const overStock = checkStock && p && it.quantity > p.stock;
              return (
                <tr key={it.productId}>
                  <td>
                    <div className="bold">{p?.name ?? `Produto #${it.productId}`}</div>
                    <div className="muted small">
                      {p?.sku}
                      {overStock && <span className="text-danger"> · quantidade acima do estoque ({p!.stock})</span>}
                    </div>
                  </td>
                  <td className="num">
                    {readOnly ? (
                      `${it.quantity} ${p?.unit ?? ""}`
                    ) : (
                      <input
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={it.quantity}
                        onChange={(e) => update(idx, { quantity: Number(e.target.value) })}
                        style={{ textAlign: "right" }}
                      />
                    )}
                  </td>
                  <td className="num">
                    {readOnly ? (
                      fmt(it.price)
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={it.price}
                        onChange={(e) => update(idx, { price: Number(e.target.value) })}
                        style={{ textAlign: "right" }}
                      />
                    )}
                  </td>
                  <td className="num bold">{fmt(it.quantity * it.price)}</td>
                  {!readOnly && (
                    <td className="actions">
                      <button
                        type="button"
                        className="btn sm danger"
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                        title="Remover"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 4 : 5} className="empty">
                  {allowEmpty ? "Nenhuma peça/produto vinculado." : "Nenhum item adicionado."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="totals mt">
        <div className="line">
          <span className="muted">{showLaborCost ? "Subtotal de peças" : "Subtotal"}</span>
          <span>{fmt(subtotal)}</span>
        </div>
        {showLaborCost && (
          <div className="line" style={{ alignItems: "center" }}>
            <span className="muted">Mão de obra (R$)</span>
            {readOnly ? (
              <span>{fmt(laborCost)}</span>
            ) : (
              <input
                type="number"
                min="0"
                step="0.01"
                value={laborCost}
                onChange={(e) => setLaborCost(Number(e.target.value))}
                style={{ width: 130, textAlign: "right" }}
              />
            )}
          </div>
        )}
        {showDiscount && (
          <div className="line" style={{ alignItems: "center" }}>
            <span className="muted">Desconto (R$)</span>
            {readOnly ? (
              <span>{fmt(discount)}</span>
            ) : (
              <input
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                style={{ width: 130, textAlign: "right" }}
              />
            )}
          </div>
        )}
        <div className="line total">
          <span>Total</span>
          <span>{fmt(total)}</span>
        </div>
      </div>
    </div>
  );
}
