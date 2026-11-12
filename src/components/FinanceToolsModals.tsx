"use client";

import { useState, useTransition } from "react";
import { Building2, CheckCircle2, FileSpreadsheet, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { brl } from "@/lib/format";
import { generateSampleOfx, parseOfxContent, type ParsedOfxStatement } from "@/lib/ofx-parser";
import {
  createBankAccountAction,
  deleteBankAccountAction,
  importOfxStatementAction,
} from "@/app/(app)/financeiro/actions";

export type BankAccountSummary = {
  id: number;
  name: string;
  bankName: string | null;
  agency: string | null;
  accountNumber: string | null;
  type: string;
  initialBalance: number;
  currentBalance: number;
};

export function FinanceToolsModals({ accounts }: { accounts: BankAccountSummary[] }) {
  const [ofxOpen, setOfxOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);

  const [ofxContent, setOfxContent] = useState("");
  const [selectedBankId, setSelectedBankId] = useState<string>(accounts[0]?.id ? String(accounts[0].id) : "");
  const [preview, setPreview] = useState<ParsedOfxStatement | null>(null);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOfxText(text: string) {
    setOfxContent(text);
    setFeedback(null);
    if (!text.trim()) {
      setPreview(null);
      return;
    }
    try {
      setPreview(parseOfxContent(text));
    } catch (e) {
      setPreview(null);
      setFeedback({ type: "error", text: e instanceof Error ? e.message : "OFX inválido." });
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") handleOfxText(reader.result);
    };
    reader.readAsText(file);
  }

  function handleOfxSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ofxContent.trim()) return;
    const fd = new FormData();
    fd.set("ofxContent", ofxContent);
    if (selectedBankId) fd.set("bankAccountId", selectedBankId);

    startTransition(async () => {
      const res = await importOfxStatementAction(fd);
      if (res.error) {
        setFeedback({ type: "error", text: res.error });
      } else if (res.ok && res.message) {
        setFeedback({ type: "ok", text: res.message });
        setPreview(null);
        setOfxContent("");
      }
    });
  }

  function handleBankSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const formEl = e.currentTarget;
    startTransition(async () => {
      const res = await createBankAccountAction(fd);
      if (res.error) setFeedback({ type: "error", text: res.error });
      else {
        formEl.reset();
        setFeedback({ type: "ok", text: "Conta / Carteira cadastrada com sucesso!" });
      }
    });
  }

  return (
    <>
      <button type="button" className="btn secondary" onClick={() => { setFeedback(null); setBankOpen(true); }}>
        <Building2 size={15} /> Contas & Bancos
      </button>
      <button type="button" className="btn secondary" onClick={() => { setFeedback(null); setOfxOpen(true); }}>
        <FileSpreadsheet size={15} /> Conciliar Extrato .OFX
      </button>

      {/* Modal Conciliação OFX */}
      {ofxOpen && (
        <div className="cmd-backdrop" style={{ zIndex: 1000 }} onClick={() => !isPending && setOfxOpen(false)}>
          <div
            className="card"
            style={{ width: "min(740px, 95vw)", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header">
              <h2>
                <FileSpreadsheet size={18} /> Conciliação Bancária Automática (.OFX)
              </h2>
              <button type="button" className="btn sm ghost" onClick={() => setOfxOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <p className="small muted mb">
              Envie o extrato <code>.ofx</code> exportado do seu banco (Itaú, Bradesco, Nubank, Inter, BB, Santander,
              etc.). O sistema dá baixa automática em lançamentos pendentes de mesmo valor ou cria os registros já
              conciliados.
            </p>

            {feedback && (
              <div className={`alert ${feedback.type === "ok" ? "success" : "error"} mb`}>
                {feedback.type === "ok" && <CheckCircle2 size={15} className="icon-inline" />} {feedback.text}
              </div>
            )}

            <form onSubmit={handleOfxSubmit}>
              <div className="form-grid">
                <div className="field s5">
                  <label>Conta Bancária Destino</label>
                  <select value={selectedBankId} onChange={(e) => setSelectedBankId(e.target.value)}>
                    <option value="">Selecionar conta...</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({brl(acc.currentBalance)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field s4">
                  <label>Arquivo .OFX do Banco</label>
                  <input type="file" accept=".ofx,.txt" onChange={handleFileChange} />
                </div>

                <div className="field s3" style={{ display: "flex", alignItems: "flex-end" }}>
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => handleOfxText(generateSampleOfx())}
                  >
                    <Sparkles size={14} /> Extrato Exemplo
                  </button>
                </div>
              </div>

              {preview && (
                <div className="mt" style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-subtle)" }}>
                  <div className="row between mb small">
                    <strong>{preview.transactions.length} transação(ões) identificada(s) no extrato</strong>
                    {preview.bankId && <span className="muted">Banco: {preview.bankId} | Conta: {preview.accountId}</span>}
                  </div>
                  <div className="table-wrap" style={{ maxHeight: 220, overflowY: "auto" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Descrição no Extrato</th>
                          <th>Tipo</th>
                          <th className="num">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.transactions.map((t) => (
                          <tr key={t.fitId}>
                            <td className="small">{t.date}</td>
                            <td className="bold small">{t.description}</td>
                            <td>
                              <span className={`badge ${t.type === "RECEITA" ? "success" : "danger"}`}>{t.type}</span>
                            </td>
                            <td className="num bold">{brl(t.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="form-actions mt">
                <button type="button" className="btn secondary" onClick={() => setOfxOpen(false)}>
                  Fechar
                </button>
                <button type="submit" className="btn" disabled={!preview || isPending}>
                  {isPending ? <Loader2 size={15} className="spin-icon" /> : <CheckCircle2 size={15} />}
                  {isPending ? "Conciliando..." : "Conciliar e Baixar Lançamentos"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Contas Bancárias / Carteiras */}
      {bankOpen && (
        <div className="cmd-backdrop" style={{ zIndex: 1000 }} onClick={() => !isPending && setBankOpen(false)}>
          <div
            className="card"
            style={{ width: "min(680px, 95vw)", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header">
              <h2>
                <Building2 size={18} /> Contas Bancárias & Carteiras
              </h2>
              <button type="button" className="btn sm ghost" onClick={() => setBankOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {feedback && (
              <div className={`alert ${feedback.type === "ok" ? "success" : "error"} mb`}>{feedback.text}</div>
            )}

            <div className="table-wrap mb">
              <table>
                <thead>
                  <tr>
                    <th>Conta / Carteira</th>
                    <th>Instituição</th>
                    <th>Tipo</th>
                    <th className="num">Saldo Inicial</th>
                    <th className="num">Saldo Atual</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((acc) => (
                    <tr key={acc.id}>
                      <td className="bold">{acc.name}</td>
                      <td className="small muted">
                        {acc.bankName || "—"} {acc.accountNumber ? `(${acc.accountNumber})` : ""}
                      </td>
                      <td>
                        <span className="badge neutral">{acc.type}</span>
                      </td>
                      <td className="num">{brl(acc.initialBalance)}</td>
                      <td className="num bold">{brl(acc.currentBalance)}</td>
                      <td className="num">
                        <button
                          type="button"
                          className="btn sm ghost"
                          onClick={() => startTransition(() => deleteBankAccountAction(acc.id))}
                          title="Remover conta"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <form onSubmit={handleBankSubmit} style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <h3 style={{ fontSize: 14, marginBottom: 10 }}>Adicionar Nova Conta / Carteira</h3>
              <div className="form-grid">
                <div className="field s5">
                  <label>Nome de Identificação *</label>
                  <input name="name" placeholder="Ex: Banco Inter PJ" required />
                </div>
                <div className="field s4">
                  <label>Banco / Instituição</label>
                  <input name="bankName" placeholder="Ex: 077 - Banco Inter" />
                </div>
                <div className="field s3">
                  <label>Tipo</label>
                  <select name="type" defaultValue="CORRENTE">
                    <option value="CORRENTE">Conta Corrente</option>
                    <option value="DIGITAL">Conta Digital / PIX</option>
                    <option value="CAIXA">Caixa Físico</option>
                    <option value="INVESTIMENTO">Reserva / Investimento</option>
                  </select>
                </div>
                <div className="field s4">
                  <label>Agência</label>
                  <input name="agency" placeholder="0001" />
                </div>
                <div className="field s4">
                  <label>Nº da Conta</label>
                  <input name="accountNumber" placeholder="123456-7" />
                </div>
                <div className="field s4">
                  <label>Saldo Inicial (R$)</label>
                  <input name="initialBalance" type="number" step="0.01" defaultValue="0" />
                </div>
              </div>
              <div className="form-actions mt">
                <button type="submit" className="btn" disabled={isPending}>
                  <Plus size={15} /> Cadastrar Conta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
