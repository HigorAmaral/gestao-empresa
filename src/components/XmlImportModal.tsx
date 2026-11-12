"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, FileCode2, FileUp, Loader2, Sparkles, X } from "lucide-react";
import { brl } from "@/lib/format";
import { generateSampleSupplierXml, parseNfeXml, type ParsedNfeDocument } from "@/lib/nfe/xml-import";
import { importPurchaseXml } from "@/app/(app)/compras/actions";

export function XmlImportModal() {
  const [open, setOpen] = useState(false);
  const [xmlContent, setXmlContent] = useState("");
  const [preview, setPreview] = useState<ParsedNfeDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receiveImmediately, setReceiveImmediately] = useState(true);
  const [markupPercent, setMarkupPercent] = useState(45);
  const [isPending, startTransition] = useTransition();

  function handleXmlChange(text: string) {
    setXmlContent(text);
    setError(null);
    if (!text.trim()) {
      setPreview(null);
      return;
    }
    try {
      const parsed = parseNfeXml(text);
      setPreview(parsed);
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : "XML inválido.");
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        handleXmlChange(reader.result);
      }
    };
    reader.readAsText(file);
  }

  function handleLoadSample() {
    const sample = generateSampleSupplierXml();
    handleXmlChange(sample);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!xmlContent.trim()) {
      setError("Selecione um arquivo .xml de NF-e primeiro.");
      return;
    }
    const fd = new FormData();
    fd.set("xmlContent", xmlContent);
    fd.set("receiveImmediately", receiveImmediately ? "true" : "false");
    fd.set("markupPercent", String(markupPercent));

    startTransition(async () => {
      const res = await importPurchaseXml(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <>
      <button type="button" className="btn secondary" onClick={() => setOpen(true)}>
        <FileUp size={15} /> Importar XML NF-e
      </button>

      {open && (
        <div
          className="cmd-backdrop"
          style={{ zIndex: 1000 }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isPending) setOpen(false);
          }}
        >
          <div className="card" style={{ width: "min(760px, 95vw)", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="card-header">
              <h2>
                <FileCode2 size={18} /> Importar XML de NF-e de Fornecedor (Entrada Automática)
              </h2>
              <button type="button" className="btn sm ghost" onClick={() => setOpen(false)} disabled={isPending}>
                <X size={16} />
              </button>
            </div>

            <p className="muted small mb">
              Envie o arquivo <code>.xml</code> da Nota Fiscal do fornecedor. O sistema cadastra o fornecedor, cria ou
              atualiza os produtos (com NCM e custo), dá entrada no estoque e lança as duplicatas no Contas a Pagar.
            </p>

            {error && <div className="alert error mb">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="field s8">
                  <label>Selecionar arquivo .XML da NF-e</label>
                  <input type="file" accept=".xml,text/xml" onChange={handleFileUpload} />
                </div>
                <div className="field s4" style={{ display: "flex", alignItems: "flex-end" }}>
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={handleLoadSample}
                  >
                    <Sparkles size={14} /> Testar com XML Exemplo
                  </button>
                </div>

                <div className="field s4">
                  <label>Margem sugerida p/ novos produtos (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={markupPercent}
                    onChange={(e) => setMarkupPercent(Number(e.target.value))}
                  />
                </div>

                <div className="field s8" style={{ display: "flex", alignItems: "center", paddingTop: 18 }}>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={receiveImmediately}
                      onChange={(e) => setReceiveImmediately(e.target.checked)}
                    />
                    Dar entrada imediata no estoque e gerar registro em Recebimento
                  </label>
                </div>
              </div>

              {preview && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 14,
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--surface-subtle)",
                  }}
                >
                  <div className="row between" style={{ flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                    <div>
                      <div className="bold" style={{ fontSize: 14 }}>
                        <CheckCircle2 size={14} className="icon-inline" /> NF-e Nº {preview.number} (Série{" "}
                        {preview.series}) — {preview.supplier.name}
                      </div>
                      <div className="small muted">
                        CNPJ: {preview.supplier.cnpj || "—"} | Emissão: {preview.issueDate} |{" "}
                        {preview.supplier.city ?? ""}/{preview.supplier.state ?? ""}
                      </div>
                    </div>
                    <div className="badge success" style={{ fontSize: 13 }}>
                      Total: {brl(preview.totalInvoice)}
                    </div>
                  </div>

                  <div className="table-wrap" style={{ maxHeight: 210, overflowY: "auto" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>SKU / Cód.</th>
                          <th>Produto</th>
                          <th>NCM</th>
                          <th className="num">Qtd</th>
                          <th className="num">Custo Un.</th>
                          <th className="num">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.items.map((it) => (
                          <tr key={it.itemNumber}>
                            <td className="small bold">{it.code}</td>
                            <td>{it.name}</td>
                            <td className="small muted">{it.ncm}</td>
                            <td className="num">
                              {it.quantity} {it.unit}
                            </td>
                            <td className="num">{brl(it.unitCost)}</td>
                            <td className="num bold">{brl(it.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {preview.duplicates.length > 0 && (
                    <div className="mt small">
                      <span className="bold">Parcelas / Duplicatas na NF-e ({preview.duplicates.length}x): </span>
                      {preview.duplicates.map((d) => `${d.number} (${d.dueDate}: ${brl(d.amount)})`).join(" • ")}
                    </div>
                  )}
                </div>
              )}

              <div className="form-actions" style={{ marginTop: 18 }}>
                <button type="button" className="btn secondary" onClick={() => setOpen(false)} disabled={isPending}>
                  Cancelar
                </button>
                <button type="submit" className="btn" disabled={!preview || isPending}>
                  {isPending ? <Loader2 size={15} className="spin-icon" /> : <FileUp size={15} />}
                  {isPending ? "Importando NF-e..." : "Confirmar Importação da NF-e"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
