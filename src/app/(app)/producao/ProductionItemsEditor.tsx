"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle, MapPin, Plus, Trash2 } from "lucide-react";

export type ProductionProduct = {
  id: number;
  sku: string;
  name: string;
  unit: string;
  stock: number;
  locations?: {
    locationId: number;
    code: string;
    quantity: number;
    description?: string | null;
  }[];
};

export type LocationOption = {
  id: number;
  code: string;
  aisle?: string | null;
  rack?: string | null;
  shelf?: string | null;
  bin?: string | null;
  description?: string | null;
};

export type ProductionItemRow = {
  productId: number;
  quantityRequired: number;
  locationId?: number | null;
  notes?: string;
};

export function ProductionItemsEditor({
  products,
  locations,
  initialItems = [],
}: {
  products: ProductionProduct[];
  locations: LocationOption[];
  initialItems?: ProductionItemRow[];
}) {
  const [items, setItems] = useState<ProductionItemRow[]>(initialItems);
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  function addItem() {
    const pId = Number(selectedProductId);
    const prod = productsById.get(pId);
    if (!prod) return;

    // Se o produto já possui um endereço com saldo, sugere esse endereço
    const preferredLocation = prod.locations && prod.locations.length > 0 ? prod.locations[0].locationId : null;

    setItems((prev) => [
      ...prev,
      {
        productId: prod.id,
        quantityRequired: 1,
        locationId: preferredLocation,
        notes: "",
      },
    ]);
    setSelectedProductId("");
  }

  function updateItem(index: number, patch: Partial<ProductionItemRow>) {
    setItems((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Input Oculto serializando a lista de insumos em JSON */}
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      {/* Seletor para adicionar matéria-prima à OP */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
          style={{ flex: 1, minWidth: 260 }}
        >
          <option value="">Selecione uma matéria-prima / insumo para adicionar à lista...</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku ? `[${p.sku}] ` : ""}
              {p.name} (Saldo: {p.stock} {p.unit})
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn"
          onClick={addItem}
          disabled={!selectedProductId}
          style={{ whiteSpace: "nowrap" }}
        >
          <Plus size={16} /> Adicionar Insumo à OP
        </button>
      </div>

      {/* Tabela dos Insumos da Ordem de Produção */}
      {items.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--border)",
            borderRadius: 8,
            padding: "24px 16px",
            textAlign: "center",
            color: "var(--muted)",
          }}
        >
          Nenhum insumo ou matéria-prima adicionada ainda. Adicione os itens necessários para que o almoxarifado possa separar e entregar na máquina.
        </div>
      ) : (
        <div className="table-responsive" style={{ border: "1px solid var(--border)", borderRadius: 8 }}>
          <table style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Insumo / Matéria-Prima</th>
                <th style={{ width: 140 }}>Qtd Necessária</th>
                <th style={{ minWidth: 220 }}>Retirar do Endereço (Estoque)</th>
                <th style={{ minWidth: 160 }}>Instrução / Observação</th>
                <th style={{ width: 130 }}>Disponibilidade</th>
                <th style={{ width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const prod = productsById.get(item.productId);
                const reqQty = Number(item.quantityRequired) || 0;
                const stock = prod?.stock ?? 0;
                const isSufficient = stock >= reqQty;

                return (
                  <tr key={idx}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{prod?.name || "Produto #" + item.productId}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {prod?.sku ? `SKU: ${prod.sku} • ` : ""}
                        Unidade: {prod?.unit || "UN"}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input
                          type="number"
                          min="0.001"
                          step="any"
                          value={item.quantityRequired}
                          onChange={(e) => updateItem(idx, { quantityRequired: Number(e.target.value) })}
                          style={{ width: "100%", padding: "6px 8px" }}
                          required
                        />
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>{prod?.unit}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <MapPin size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
                        <select
                          value={item.locationId ? String(item.locationId) : ""}
                          onChange={(e) => updateItem(idx, { locationId: e.target.value ? Number(e.target.value) : null })}
                          style={{ width: "100%", padding: "6px 8px", fontSize: 12.5 }}
                        >
                          <option value="">(Sem endereço específico)</option>
                          {locations.map((loc) => {
                            const details = [loc.aisle, loc.rack, loc.shelf, loc.bin].filter(Boolean).join(" / ");
                            return (
                              <option key={loc.id} value={loc.id}>
                                {loc.code} {details ? `(${details})` : ""}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </td>
                    <td>
                      <input
                        type="text"
                        placeholder="Ex: Cortar em 50cm, lote X"
                        value={item.notes || ""}
                        onChange={(e) => updateItem(idx, { notes: e.target.value })}
                        style={{ width: "100%", padding: "6px 8px", fontSize: 12 }}
                      />
                    </td>
                    <td>
                      {isSufficient ? (
                        <span className="badge green" style={{ fontSize: 11 }}>
                          <CheckCircle size={11} style={{ marginRight: 3 }} /> Saldo: {stock} {prod?.unit}
                        </span>
                      ) : (
                        <span className="badge red" style={{ fontSize: 11 }} title="Saldo insuficiente no estoque">
                          <AlertTriangle size={11} style={{ marginRight: 3 }} /> Falta ({stock} / {reqQty})
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="btn ghost text-danger"
                        style={{ padding: "4px 6px" }}
                        title="Remover insumo"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "var(--bg-subtle, #f4f4f5)", fontWeight: 600 }}>
                <td>Total de Itens da Lista: {items.length}</td>
                <td colSpan={5} style={{ fontSize: 12, color: "var(--muted)" }}>
                  Estes materiais serão impressos na <strong>Ficha da Máquina</strong> para separação e entrega no posto de trabalho.
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
