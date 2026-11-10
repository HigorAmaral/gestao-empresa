"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Camera, CheckCircle2, MapPin, Plus, Trash2 } from "lucide-react";
import { brl } from "@/lib/format";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";

export type ReceiptProduct = {
  id: number;
  sku: string;
  name: string;
  unit: string;
  costPrice: number;
  stock: number;
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

export type ReceiptItemRow = {
  productId: number;
  quantity: number;
  unitCost: number;
  locationId?: number | null;
  batch?: string;
  notes?: string;
};

export function ReceiptItemsEditor({
  products,
  locations,
  initialItems = [],
}: {
  products: ReceiptProduct[];
  locations: LocationOption[];
  initialItems?: ReceiptItemRow[];
}) {
  const [items, setItems] = useState<ReceiptItemRow[]>(initialItems);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanNotification, setScanNotification] = useState<string | null>(null);

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const totalQuantity = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const totalCost = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0);

  function addItem(pId?: number) {
    const id = pId !== undefined ? pId : Number(selectedProductId);
    const prod = productsById.get(id);
    if (!prod) return;

    // Se já estiver na lista, incrementa quantidade
    const existingIndex = items.findIndex((i) => i.productId === id);
    if (existingIndex >= 0) {
      setItems((prev) =>
        prev.map((row, idx) =>
          idx === existingIndex ? { ...row, quantity: row.quantity + 1 } : row
        )
      );
      setScanNotification(`+1 un adicionada ao produto "${prod.name}" (total: ${items[existingIndex].quantity + 1}).`);
    } else {
      setItems((prev) => [
        ...prev,
        {
          productId: prod.id,
          quantity: 1,
          unitCost: prod.costPrice || 0,
          locationId: locations.length > 0 ? locations[0].id : null,
          batch: "",
          notes: "",
        },
      ]);
      setScanNotification(`Produto "${prod.name}" adicionado à conferência.`);
    }

    if (pId === undefined) setSelectedProductId("");
  }

  function updateItem(index: number, patch: Partial<ReceiptItemRow>) {
    setItems((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleBarcodeScanned(code: string) {
    const clean = code.trim().toLowerCase();
    const prod = products.find(
      (p) =>
        (p.sku && p.sku.toLowerCase() === clean) ||
        p.name.toLowerCase() === clean ||
        String(p.id) === clean
    );

    if (prod) {
      addItem(prod.id);
      return;
    }

    // Se for código de localização
    const loc = locations.find((l) => l.code.toLowerCase() === clean);
    if (loc && items.length > 0) {
      updateItem(items.length - 1, { locationId: loc.id });
      setScanNotification(`Endereço "${loc.code}" vinculado ao último item conferido.`);
      return;
    }

    setScanNotification(`Código "${code}" não encontrado no cadastro de produtos ou endereços.`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Input Oculto serializando os itens em JSON para o Server Action */}
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      {scanNotification && (
        <div
          style={{
            padding: "8px 12px",
            background: scanNotification.includes("não encontrado") ? "#fef2f2" : "#ecfdf5",
            color: scanNotification.includes("não encontrado") ? "#b91c1c" : "#047857",
            borderRadius: 6,
            fontSize: 12.5,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <CheckCircle2 size={14} />
          <span>{scanNotification}</span>
        </div>
      )}

      {/* Seletor para Adicionar Insumo / Mercadoria & Bipagem */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
          style={{ flex: 1, minWidth: 260 }}
        >
          <option value="">Selecione o produto ou matéria-prima para adicionar...</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku ? `[${p.sku}] ` : ""}
              {p.name} (Atual: {p.stock} {p.unit})
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn"
          onClick={() => addItem()}
          disabled={!selectedProductId}
          style={{ whiteSpace: "nowrap" }}
        >
          <Plus size={16} /> Adicionar Item à Carga
        </button>

        <button
          type="button"
          className="btn secondary"
          onClick={() => setScannerOpen(true)}
          style={{ whiteSpace: "nowrap" }}
          title="Bipar código de barras com a câmera ou leitor"
        >
          <Camera size={16} /> Bipar Código de Barras
        </button>
      </div>

      {/* Tabela dos Itens da Carga */}
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
          Nenhum item adicionado ainda. Selecione um produto acima ou clique em <strong>Bipar Código de Barras</strong> para iniciar a conferência rápida.
        </div>
      ) : (
        <div className="table-responsive" style={{ border: "1px solid var(--border)", borderRadius: 8 }}>
          <table style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>Produto / Matéria-Prima</th>
                <th style={{ width: 110 }}>Qtd Recebida</th>
                <th style={{ width: 130 }}>Custo Unit. (R$)</th>
                <th style={{ minWidth: 190 }}>Endereço no Estoque</th>
                <th style={{ width: 140 }}>Lote / Ref</th>
                <th style={{ width: 110, textAlign: "right" }}>Subtotal</th>
                <th style={{ width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const prod = productsById.get(item.productId);
                const sub = (Number(item.quantity) || 0) * (Number(item.unitCost) || 0);

                return (
                  <tr key={idx}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{prod?.name || "Produto #" + item.productId}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {prod?.sku ? `SKU: ${prod.sku} • ` : ""}
                        Unidade: {prod?.unit || "UN"} • Estoque Atual: {prod?.stock ?? 0}
                      </div>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                        style={{ width: "100%", padding: "6px 8px" }}
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitCost}
                        onChange={(e) => updateItem(idx, { unitCost: Number(e.target.value) })}
                        style={{ width: "100%", padding: "6px 8px" }}
                      />
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <MapPin size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
                        <select
                          value={item.locationId ? String(item.locationId) : ""}
                          onChange={(e) => updateItem(idx, { locationId: e.target.value ? Number(e.target.value) : null })}
                          style={{ width: "100%", padding: "6px 8px", fontSize: 12.5 }}
                        >
                          <option value="">(Sem endereço - geral)</option>
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
                        placeholder="Ex: L2026-A"
                        value={item.batch || ""}
                        onChange={(e) => updateItem(idx, { batch: e.target.value })}
                        style={{ width: "100%", padding: "6px 8px", fontSize: 12 }}
                      />
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{brl(sub)}</td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="btn ghost text-danger"
                        style={{ padding: "4px 6px" }}
                        title="Remover item da carga"
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
                <td>Total da Carga ({items.length} itens)</td>
                <td>{totalQuantity} un</td>
                <td>—</td>
                <td colSpan={2} style={{ fontSize: 12, color: "var(--muted)" }}>
                  Endereçamento automático no estoque
                </td>
                <td style={{ textAlign: "right" }}>{brl(totalCost)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Leitor de código de barras pela câmera */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title="Bipar Produto no Recebimento"
        instruction="Aponte a câmera para o código de barras da caixa ou embalagem do produto recebido."
      />
    </div>
  );
}
