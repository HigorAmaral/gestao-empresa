"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Cpu,
  Factory,
  Layers,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Wrench,
  Zap,
} from "lucide-react";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";
import { createProductionOrder } from "./actions";

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

export type MachineOption = {
  id: number;
  name: string;
  code?: string | null;
  category?: string | null;
  location?: string | null;
};

export type RecipeItemData = {
  id: number;
  productId: number;
  componentId: number;
  quantity: number;
  notes?: string | null;
  component: {
    id: number;
    sku: string;
    name: string;
    unit: string;
    stock: number;
    stockLocations?: {
      locationId: number;
      quantity: number;
      location: {
        code: string;
        description?: string | null;
      };
    }[];
  };
};

export type ProductionItemRow = {
  productId: number;
  quantityRequired: number;
  locationId?: number | null;
  notes?: string;
};

export function ProductionOrderForm({
  products,
  locations,
  machines,
  recipes,
  defaultMachine = "",
  defaultProductId,
}: {
  products: ProductionProduct[];
  locations: LocationOption[];
  machines: MachineOption[];
  recipes: RecipeItemData[];
  defaultMachine?: string;
  defaultProductId?: number;
}) {
  const [targetProductId, setTargetProductId] = useState<string>(
    defaultProductId ? String(defaultProductId) : ""
  );
  const [targetQuantity, setTargetQuantity] = useState<string>("10");
  const [selectedMachine, setSelectedMachine] = useState<string>(defaultMachine);
  const [customMachine, setCustomMachine] = useState<string>("");
  const [items, setItems] = useState<ProductionItemRow[]>([]);
  const [manualAddId, setManualAddId] = useState<string>("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // Agrupa receitas por produto acabado
  const recipesByProductId = useMemo(() => {
    const map = new Map<number, RecipeItemData[]>();
    for (const r of recipes) {
      const list = map.get(r.productId) || [];
      list.push(r);
      map.set(r.productId, list);
    }
    return map;
  }, [recipes]);

  const activeRecipe = targetProductId ? recipesByProductId.get(Number(targetProductId)) : null;

  // Carrega insumos da Ficha Técnica (BOM) baseado na quantidade planejada
  function loadRecipeBom(customQty?: number) {
    if (!targetProductId) return;
    const pId = Number(targetProductId);
    const recipeItems = recipesByProductId.get(pId);
    if (!recipeItems || recipeItems.length === 0) return;

    const plannedQty = customQty !== undefined ? customQty : Number(targetQuantity) || 1;

    const newRows: ProductionItemRow[] = recipeItems.map((r) => {
      // Sugere endereço de estoque com maior saldo ou primeiro endereço
      const preferredLoc =
        r.component.stockLocations && r.component.stockLocations.length > 0
          ? r.component.stockLocations[0].locationId
          : null;

      const totalNeeded = Math.round(r.quantity * plannedQty * 1000) / 1000;

      return {
        productId: r.componentId,
        quantityRequired: totalNeeded,
        locationId: preferredLoc,
        notes: r.notes || "",
      };
    });

    setItems(newRows);
  }

  function handleProductChange(newPid: string) {
    setTargetProductId(newPid);
    const pId = Number(newPid);
    const recipeItems = recipesByProductId.get(pId);
    if (recipeItems && recipeItems.length > 0) {
      const plannedQty = Number(targetQuantity) || 10;
      const newRows: ProductionItemRow[] = recipeItems.map((r) => {
        const preferredLoc =
          r.component.stockLocations && r.component.stockLocations.length > 0
            ? r.component.stockLocations[0].locationId
            : null;
        return {
          productId: r.componentId,
          quantityRequired: Math.round(r.quantity * plannedQty * 1000) / 1000,
          locationId: preferredLoc,
          notes: r.notes || "",
        };
      });
      setItems(newRows);
    }
  }

  function handleQuantityChange(newQtyStr: string) {
    setTargetQuantity(newQtyStr);
    const newQty = Number(newQtyStr);
    if (newQty > 0 && activeRecipe && activeRecipe.length > 0 && items.length > 0) {
      // Atualiza proporcionalmente se os itens atuais coincidem com a receita
      const recipeMap = new Map(activeRecipe.map((r) => [r.componentId, r.quantity]));
      setItems((prev) =>
        prev.map((item) => {
          const ratio = recipeMap.get(item.productId);
          if (ratio) {
            return {
              ...item,
              quantityRequired: Math.round(ratio * newQty * 1000) / 1000,
            };
          }
          return item;
        })
      );
    }
  }

  function addItem(pId: number) {
    const prod = productsById.get(pId);
    if (!prod) return;
    const preferredLoc = prod.locations && prod.locations.length > 0 ? prod.locations[0].locationId : null;

    setItems((prev) => [
      ...prev,
      {
        productId: prod.id,
        quantityRequired: 1,
        locationId: preferredLoc,
        notes: "",
      },
    ]);
    setManualAddId("");
  }

  function updateItem(index: number, patch: Partial<ProductionItemRow>) {
    setItems((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleBarcodeScanned(code: string) {
    const clean = code.trim().toLowerCase();
    // Procura por SKU ou nome
    const found = products.find(
      (p) =>
        (p.sku && p.sku.toLowerCase() === clean) ||
        p.name.toLowerCase() === clean ||
        String(p.id) === clean
    );

    if (found) {
      addItem(found.id);
      setErrorMsg(null);
    } else {
      // Verifica se é um código de localização (ex: A-01-01)
      const foundLoc = locations.find((l) => l.code.toLowerCase() === clean);
      if (foundLoc && items.length > 0) {
        // Atribui ao último item adicionado
        updateItem(items.length - 1, { locationId: foundLoc.id });
      } else {
        setErrorMsg(`Código "${code}" não corresponde a nenhum produto ou endereço cadastrado.`);
      }
    }
  }

  const finalMachineValue = selectedMachine === "__CUSTOM__" ? customMachine : selectedMachine;

  return (
    <>
      <form
        action={async (formData) => {
          setIsSubmitting(true);
          setErrorMsg(null);
          try {
            // injeta os dados no FormData
            formData.set("items", JSON.stringify(items));
            formData.set("machine", finalMachineValue);
            const res = await createProductionOrder(undefined, formData);
            if (res && res.error) {
              setErrorMsg(res.error);
              setIsSubmitting(false);
            }
          } catch (err: unknown) {
            setIsSubmitting(false);
            if (err && typeof err === "object" && "digest" in err && String((err as { digest: string }).digest).startsWith("NEXT_REDIRECT")) {
              throw err;
            }
            setErrorMsg(err instanceof Error ? err.message : "Erro ao processar formulário.");
          }
        }}
      >
        {errorMsg && (
          <div
            style={{
              padding: "10px 14px",
              background: "#fee2e2",
              color: "#b91c1c",
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 13.5,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Seção 1: Dados do Produto a Fabricar e Máquina */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))",
            gap: 16,
            marginBottom: 20,
          }}
        >
          {/* Produto a Fabricar */}
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                Produto Acabado a Fabricar *
              </label>
              {activeRecipe && activeRecipe.length > 0 && (
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--primary, #2563eb)",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Sparkles size={13} />
                  Ficha Técnica ativa ({activeRecipe.length} insumos configurados)
                </span>
              )}
            </div>
            <select
              name="productId"
              required
              value={targetProductId}
              onChange={(e) => handleProductChange(e.target.value)}
              style={{ width: "100%", padding: "10px 12px" }}
            >
              <option value="">Selecione o produto final que será produzido...</option>
              {products.map((p) => {
                const hasRecipe = recipesByProductId.has(p.id);
                return (
                  <option key={p.id} value={p.id}>
                    {p.sku ? `[${p.sku}] ` : ""}
                    {p.name} (Saldo atual: {p.stock} {p.unit})
                    {hasRecipe ? " ★ [Com Ficha Técnica]" : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Quantidade a Fabricar */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Quantidade Planejada *
            </label>
            <input
              type="number"
              name="quantity"
              min="0.01"
              step="any"
              value={targetQuantity}
              onChange={(e) => handleQuantityChange(e.target.value)}
              placeholder="Ex: 50"
              required
              style={{ width: "100%", padding: "9px 12px" }}
            />
          </div>

          {/* Máquina / Posto de Destino */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Máquina / Posto de Trabalho *
            </label>
            <select
              value={selectedMachine}
              onChange={(e) => setSelectedMachine(e.target.value)}
              required
              style={{ width: "100%", padding: "9px 12px" }}
            >
              <option value="">Selecione o posto ou máquina de destino...</option>
              {machines.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.code ? `[${m.code}] ` : ""}
                  {m.name} {m.category ? `(${m.category})` : ""}
                  {m.location ? ` - ${m.location}` : ""}
                </option>
              ))}
              <option value="__CUSTOM__">✍ Outra máquina / digitar manualmente...</option>
            </select>

            {selectedMachine === "__CUSTOM__" && (
              <input
                type="text"
                placeholder="Nome da máquina ou posto..."
                value={customMachine}
                onChange={(e) => setCustomMachine(e.target.value)}
                style={{ width: "100%", marginTop: 8, padding: "8px 12px" }}
                required
              />
            )}
          </div>

          {/* Operador */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Operador Responsável
            </label>
            <input
              type="text"
              name="operatorName"
              placeholder="Ex: Carlos Oliveira"
              style={{ width: "100%", padding: "9px 12px" }}
            />
          </div>

          {/* Prioridade */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Prioridade da OP
            </label>
            <select name="priority" defaultValue="NORMAL" style={{ width: "100%", padding: "9px 12px" }}>
              <option value="BAIXA">Baixa</option>
              <option value="NORMAL">Normal</option>
              <option value="ALTA">Alta</option>
              <option value="URGENTE">Urgente</option>
            </select>
          </div>

          {/* Data de Previsão */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Previsão de Entrega na Máquina
            </label>
            <input type="date" name="deliveryDate" style={{ width: "100%", padding: "8px 12px" }} />
          </div>

          {/* Instruções */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Instruções Técnicas e Operacionais
            </label>
            <textarea
              name="notes"
              rows={2}
              placeholder="Instruções para o operador da máquina, desenho técnico de referência, tolerâncias ou cuidados especiais..."
              style={{ width: "100%", padding: "8px 12px" }}
            />
          </div>
        </div>

        {/* Seção 2: Lista de Insumos e Separação (BOM) */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 18, marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <Layers size={18} />
                Lista de Insumos & Matérias-Primas Necessárias (BOM)
              </h3>
              <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "3px 0 0" }}>
                Materiais que devem ser retirados do estoque e transportados até a máquina para fabricar as {targetQuantity || "0"} unidades.
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {activeRecipe && activeRecipe.length > 0 && (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => loadRecipeBom()}
                  style={{ fontSize: 12.5 }}
                  title="Recalcula insumos da Ficha Técnica para a quantidade planejada"
                >
                  <Sparkles size={14} />
                  Carregar da Ficha Técnica (BOM)
                </button>
              )}

              <button
                type="button"
                className="btn secondary"
                onClick={() => setScannerOpen(true)}
                style={{ fontSize: 12.5 }}
                title="Bipar código de barras do insumo com a câmera ou leitor"
              >
                <Camera size={14} />
                Bipar Código de Barras
              </button>
            </div>
          </div>

          {/* Seletor manual para adicionar item à lista */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
            <select
              value={manualAddId}
              onChange={(e) => setManualAddId(e.target.value)}
              style={{ flex: 1, minWidth: "min(100%, 240px)", padding: "8px 12px" }}
            >
              <option value="">Adicionar matéria-prima avulsa à lista...</option>
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
              onClick={() => manualAddId && addItem(Number(manualAddId))}
              disabled={!manualAddId}
              style={{ whiteSpace: "nowrap" }}
            >
              <Plus size={16} /> Adicionar Insumo
            </button>
          </div>

          {/* Tabela dos Insumos da Ordem de Produção */}
          {items.length === 0 ? (
            <div
              style={{
                border: "1px dashed var(--border)",
                borderRadius: 8,
                padding: "28px 16px",
                textAlign: "center",
                color: "var(--muted)",
                background: "var(--bg-subtle, #fafafa)",
              }}
            >
              <Package size={32} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
              <div>Nenhum insumo ou matéria-prima adicionada ainda.</div>
              {activeRecipe && activeRecipe.length > 0 ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => loadRecipeBom()}
                  style={{ marginTop: 10 }}
                >
                  <Sparkles size={14} /> Preencher com os {activeRecipe.length} insumos da Ficha Técnica
                </button>
              ) : (
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Selecione um produto que possua Ficha Técnica ou adicione itens manualmente acima.
                </div>
              )}
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
                    <th style={{ width: 140 }}>Disponibilidade</th>
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
                              <CheckCircle2 size={11} style={{ marginRight: 3 }} /> Saldo: {stock} {prod?.unit}
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
                    <td>Total de Insumos: {items.length}</td>
                    <td colSpan={5} style={{ fontSize: 12, color: "var(--muted)" }}>
                      Estes materiais serão impressos na <strong>Ficha da Máquina</strong> para separação e entrega no posto de trabalho.
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Botões de Ação */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <Link className="btn ghost" href="/producao">
            Cancelar
          </Link>
          <button type="submit" className="btn" disabled={isSubmitting || items.length === 0 || !finalMachineValue}>
            <Factory size={16} />
            {isSubmitting ? "Gerando OP..." : "Gerar Ordem de Produção"}
          </button>
        </div>
      </form>

      {/* Modal Leitor de Código de Barras / Câmera */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title="Bipar Matéria-Prima / Insumo"
        instruction="Aponte a câmera para o código de barras ou QR code do insumo ou da etiqueta do endereço de estoque."
      />
    </>
  );
}
