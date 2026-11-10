"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Calculator, CheckCircle2, Factory, Layers, MapPin, Plus, Trash2 } from "lucide-react";
import { brl, num } from "@/lib/format";
import { ActionForm } from "@/components/Forms";
import { saveProductRecipe, type RecipeComponentInput } from "./actions";

export type RecipeProductOption = {
  id: number;
  sku: string;
  name: string;
  unit: string;
  costPrice: number;
  stock: number;
  locationCode?: string | null;
};

export function ProductRecipeEditor({
  productId,
  productName,
  availableProducts,
  initialRecipe = [],
}: {
  productId: number;
  productName: string;
  availableProducts: RecipeProductOption[];
  initialRecipe?: RecipeComponentInput[];
}) {
  const [items, setItems] = useState<RecipeComponentInput[]>(initialRecipe);
  const [selectedComponentId, setSelectedComponentId] = useState<string>("");

  const productsById = useMemo(
    () => new Map(availableProducts.map((p) => [p.id, p])),
    [availableProducts]
  );

  // Calcula custo total estimado dos insumos para fabricar 1 unidade
  const estimatedCost = useMemo(() => {
    return items.reduce((sum, item) => {
      const prod = productsById.get(item.componentId);
      const cost = prod?.costPrice || 0;
      return sum + (Number(item.quantity) || 0) * cost;
    }, 0);
  }, [items, productsById]);

  function addComponent() {
    const cId = Number(selectedComponentId);
    if (!cId || cId === productId) return;

    setItems((prev) => {
      if (prev.some((i) => i.componentId === cId)) {
        return prev.map((i) => (i.componentId === cId ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { componentId: cId, quantity: 1, notes: "" }];
    });
    setSelectedComponentId("");
  }

  function updateComponent(index: number, patch: Partial<RecipeComponentInput>) {
    setItems((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  }

  function removeComponent(index: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  return (
    <div style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Factory size={18} />
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
              Ficha Técnica / Composição de Insumos (BOM)
            </h3>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "4px 0 0" }}>
            Defina as matérias-primas e quantidades necessárias para fabricar <strong>1 unidade</strong> de "{productName}".
            Ao gerar uma Ordem de Produção (OP), o sistema multiplicará esses insumos automaticamente!
          </p>
        </div>

        <div
          style={{
            background: "var(--bg-subtle, #f4f4f5)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "8px 14px",
            textAlign: "right",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>
            Custo Estimado em Insumos (1 un)
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)" }}>
            {brl(estimatedCost)}
          </div>
        </div>
      </div>

      <ActionForm action={saveProductRecipe.bind(null, productId)} submitLabel="Salvar Ficha Técnica">
        <input type="hidden" name="recipeItems" value={JSON.stringify(items)} />

        {/* Seletor de Matéria-Prima */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <select
            value={selectedComponentId}
            onChange={(e) => setSelectedComponentId(e.target.value)}
            style={{ flex: 1, minWidth: 260 }}
          >
            <option value="">Selecione um insumo para adicionar à composição...</option>
            {availableProducts
              .filter((p) => p.id !== productId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku ? `[${p.sku}] ` : ""}
                  {p.name} (Saldo: {p.stock} {p.unit} • Custo: {brl(p.costPrice)})
                </option>
              ))}
          </select>
          <button
            type="button"
            className="btn"
            onClick={addComponent}
            disabled={!selectedComponentId}
          >
            <Plus size={15} /> Adicionar Insumo
          </button>
        </div>

        {items.length === 0 ? (
          <div
            style={{
              border: "1px dashed var(--border)",
              borderRadius: 8,
              padding: "24px 16px",
              textAlign: "center",
              color: "var(--muted)",
              marginBottom: 16,
            }}
          >
            Nenhuma matéria-prima cadastrada na ficha técnica deste produto. Adicione os componentes acima se este for um produto fabricado ou montado pela empresa.
          </div>
        ) : (
          <div className="table-responsive" style={{ border: "1px solid var(--border)", borderRadius: 8, marginBottom: 16 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 220 }}>Insumo / Matéria-Prima</th>
                  <th style={{ width: 140 }}>Qtd por 1 un</th>
                  <th style={{ width: 120 }}>Custo Unit.</th>
                  <th style={{ minWidth: 160 }}>Localização no Estoque</th>
                  <th style={{ minWidth: 180 }}>Instrução / Observação</th>
                  <th style={{ width: 120, textAlign: "right" }}>Subtotal Insumo</th>
                  <th style={{ width: 44 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const prod = productsById.get(item.componentId);
                  const sub = (Number(item.quantity) || 0) * (prod?.costPrice || 0);

                  return (
                    <tr key={idx}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{prod?.name || "Insumo #" + item.componentId}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>
                          {prod?.sku ? `SKU: ${prod.sku} • ` : ""}
                          Saldo atual: {prod?.stock ?? 0} {prod?.unit || "UN"}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            value={item.quantity}
                            onChange={(e) => updateComponent(idx, { quantity: Number(e.target.value) })}
                            style={{ width: "100%", padding: "5px 8px" }}
                            required
                          />
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>{prod?.unit}</span>
                        </div>
                      </td>
                      <td>{brl(prod?.costPrice || 0)}</td>
                      <td>
                        {prod?.locationCode ? (
                          <span className="badge blue" style={{ fontSize: 11 }}>
                            <MapPin size={11} style={{ marginRight: 2 }} />
                            {prod.locationCode}
                          </span>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td>
                        <input
                          type="text"
                          placeholder="Ex: Cortar em 45°, usar cola X"
                          value={item.notes || ""}
                          onChange={(e) => updateComponent(idx, { notes: e.target.value })}
                          style={{ width: "100%", padding: "5px 8px", fontSize: 12 }}
                        />
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{brl(sub)}</td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="btn ghost text-danger"
                          style={{ padding: "4px 6px" }}
                          onClick={() => removeComponent(idx)}
                          title="Remover insumo da ficha"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ActionForm>
    </div>
  );
}
