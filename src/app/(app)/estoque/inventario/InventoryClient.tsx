"use client";

import { useMemo, useState, useTransition } from "react";
import { Camera, CheckCircle2, ClipboardCheck, Eye, EyeOff, Loader2, Search } from "lucide-react";
import { brl, num } from "@/lib/format";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";
import { applyInventoryBatchAction } from "./actions";

export type InventoryProductRow = {
  id: number;
  sku: string;
  name: string;
  category: string | null;
  unit: string;
  stock: number;
  costPrice: number;
  locations: string[];
};

export function InventoryClient({ products }: { products: InventoryProductRow[] }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [blindMode, setBlindMode] = useState(false);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [reasonNote, setReasonNote] = useState("Contagem periódica de inventário");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const categories = useMemo(() => {
    const s = new Set<string>();
    products.forEach((p) => {
      if (p.category) s.add(p.category);
    });
    return Array.from(s).sort();
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter && p.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.locations.some((l) => l.toLowerCase().includes(q))
      );
    });
  }, [products, search, categoryFilter]);

  const summary = useMemo(() => {
    let countedItems = 0;
    let divergentItems = 0;
    let netValueDiff = 0;

    for (const p of products) {
      const raw = counts[p.id];
      if (raw === undefined || raw.trim() === "") continue;
      const val = parseFloat(raw.replace(",", "."));
      if (isNaN(val)) continue;
      countedItems++;
      const diff = val - p.stock;
      if (Math.abs(diff) >= 0.0001) {
        divergentItems++;
        netValueDiff += diff * p.costPrice;
      }
    }
    return { countedItems, divergentItems, netValueDiff };
  }, [products, counts]);

  function handleBarcodeScan(code: string) {
    setScannerOpen(false);
    setSearch(code.trim());
  }

  function handleApplyBatch() {
    setFeedback(null);
    const payload = Object.entries(counts)
      .filter(([, v]) => v.trim() !== "" && !isNaN(parseFloat(v.replace(",", "."))))
      .map(([id, v]) => ({
        productId: Number(id),
        countedStock: parseFloat(v.replace(",", ".")),
      }));

    if (payload.length === 0) {
      setFeedback({ type: "error", text: "Digite a contagem física de pelo menos 1 item na tabela abaixo." });
      return;
    }

    startTransition(async () => {
      const res = await applyInventoryBatchAction(payload, reasonNote);
      if (res.error) setFeedback({ type: "error", text: res.error });
      else if (res.ok && res.message) {
        setFeedback({ type: "ok", text: res.message });
        setCounts({});
      }
    });
  }

  return (
    <div>
      <div className="stats">
        <div className="stat">
          <div className="label">Itens Contados</div>
          <div className="value">
            {summary.countedItems} / {products.length}
          </div>
          <div className="hint">Preenchidos nesta sessão</div>
        </div>
        <div className={`stat ${summary.divergentItems > 0 ? "warning" : "primary"}`}>
          <div className="label">Itens com Divergência</div>
          <div className="value">{summary.divergentItems}</div>
          <div className="hint">Diferença entre físico e sistema</div>
        </div>
        <div className={`stat ${summary.netValueDiff < 0 ? "danger" : "success"}`}>
          <div className="label">Impacto Financeiro (Custo)</div>
          <div className="value">
            {summary.netValueDiff >= 0 ? "+" : ""}
            {brl(summary.netValueDiff)}
          </div>
          <div className="hint">Sobra (+) ou Perda (−) de estoque</div>
        </div>
      </div>

      {feedback && (
        <div className={`alert ${feedback.type === "ok" ? "success" : "error"} mb`}>
          {feedback.type === "ok" && <CheckCircle2 size={16} className="icon-inline" />} {feedback.text}
        </div>
      )}

      <div className="card mb">
        <div className="row between" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="row" style={{ gap: 8, flex: 1, flexWrap: "wrap" }}>
            <div className="input-icon" style={{ flex: 1, minWidth: 220 }}>
              <Search size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto por SKU, nome ou endereço WMS..."
              />
            </div>
            <button type="button" className="btn secondary" onClick={() => setScannerOpen(true)}>
              <Camera size={15} /> Ler Etiqueta
            </button>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className={`btn ${blindMode ? "" : "secondary"}`}
              onClick={() => setBlindMode((v) => !v)}
              title="Na contagem cega o saldo do sistema fica oculto para evitar vícios de conferência"
            >
              {blindMode ? <EyeOff size={15} /> : <Eye size={15} />}
              {blindMode ? "Modo Contagem Cega: ATIVO" : "Ativar Contagem Cega"}
            </button>
          </div>
        </div>

        <div className="row between mt" style={{ paddingTop: 12, borderTop: "1px solid var(--border)", flexWrap: "wrap", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <label className="small muted">Motivo / Identificação deste Balanço</label>
            <input
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
              placeholder="Ex: Inventário Mensal Galpão A"
            />
          </div>
          <div className="row" style={{ gap: 8, alignSelf: "flex-end" }}>
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                const all: Record<number, string> = {};
                filtered.forEach((p) => {
                  all[p.id] = String(p.stock);
                });
                setCounts((prev) => ({ ...prev, ...all }));
              }}
            >
              Preencher c/ Saldo Atual
            </button>
            <button
              type="button"
              className="btn"
              disabled={summary.countedItems === 0 || isPending}
              onClick={handleApplyBatch}
            >
              {isPending ? <Loader2 size={15} className="spin-icon" /> : <ClipboardCheck size={16} />}
              {isPending ? "Aplicando Balanço..." : `Aplicar Ajustes em Lote (${summary.divergentItems} divergência(s))`}
            </button>
          </div>
        </div>
      </div>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Produto</th>
                <th>Endereços WMS</th>
                <th className="num">Saldo no Sistema</th>
                <th className="num" style={{ width: 170 }}>Contagem Física Real</th>
                <th className="num">Divergência</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const raw = counts[p.id] ?? "";
                const hasVal = raw.trim() !== "" && !isNaN(parseFloat(raw.replace(",", ".")));
                const counted = hasVal ? parseFloat(raw.replace(",", ".")) : null;
                const diff = counted !== null ? Number((counted - p.stock).toFixed(4)) : null;

                return (
                  <tr key={p.id}>
                    <td className="small bold muted">{p.sku}</td>
                    <td>
                      <div className="bold">{p.name}</div>
                      <div className="small muted">{p.category || "Sem categoria"}</div>
                    </td>
                    <td className="small">
                      {p.locations.length > 0 ? (
                        p.locations.map((loc) => (
                          <span key={loc} className="badge neutral" style={{ marginRight: 4 }}>
                            {loc}
                          </span>
                        ))
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="num bold">
                      {blindMode ? (
                        <span className="badge neutral">Oculto (Cega)</span>
                      ) : (
                        `${num(p.stock)} ${p.unit}`
                      )}
                    </td>
                    <td className="num">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={`Qtd (${p.unit})`}
                        value={raw}
                        onChange={(e) => setCounts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        style={{ textAlign: "right", fontWeight: 700 }}
                      />
                    </td>
                    <td className="num bold">
                      {diff === null ? (
                        <span className="muted">—</span>
                      ) : Math.abs(diff) < 0.0001 ? (
                        <span className="text-success">0 (Bateu)</span>
                      ) : (
                        <span className={diff > 0 ? "text-success" : "text-danger"}>
                          {diff > 0 ? `+${num(diff)}` : num(diff)} {p.unit}
                        </span>
                      )}
                    </td>
                    <td>
                      {diff === null ? (
                        <span className="badge neutral">Aguardando</span>
                      ) : Math.abs(diff) < 0.0001 ? (
                        <span className="badge success">Conferido OK</span>
                      ) : diff > 0 ? (
                        <span className="badge warning">Sobra (+{num(diff)})</span>
                      ) : (
                        <span className="badge danger">Falta ({num(diff)})</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <BarcodeScannerModal
        isOpen={scannerOpen}
        onScan={handleBarcodeScan}
        onClose={() => setScannerOpen(false)}
      />
    </div>
  );
}
