"use client";

import { useEffect, useState, useTransition } from "react";
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  FileText,
  FileUp,
  HelpCircle,
  Plus,
  RefreshCw,
  Sparkles,
  Upload,
} from "lucide-react";
import { parseOfx, type OfxParsedStatement, type OfxTransaction } from "@/lib/ofx";
import { brl, fmtDate } from "@/lib/format";
import { createAndReconcileEntryAction, reconcileExistingEntryAction } from "./actions";

interface PendingEntry {
  id: number;
  type: string;
  description: string;
  category: string;
  amount: number;
  dueDate: string;
  clientOrSupplier: string | null;
}

interface BankAccount {
  id: number;
  name: string;
  bankName: string | null;
}

interface MatchCandidate {
  entry: PendingEntry;
  score: number; // 100 = exato
}

const DEFAULT_OFX_RULES: { keywords: string[]; category: string; type?: "CREDIT" | "DEBIT" }[] = [
  { keywords: ["TARIFA", "CESTA", "MANUTENCAO", "TED", "DOC", "IOF", "JUROS"], category: "Tarifas Bancárias", type: "DEBIT" },
  { keywords: ["ENERGIA", "CELESC", "CEMIG", "ENEL", "CPFL", "COPEL", "LUZ"], category: "Energia", type: "DEBIT" },
  { keywords: ["INTERNET", "VIVO", "CLARO", "TIM", "OI ", "TELECOM", "FIBRA"], category: "Internet/Telefone", type: "DEBIT" },
  { keywords: ["ALUGUEL", "IMOBILIARIA", "CONDOMINIO"], category: "Aluguel", type: "DEBIT" },
  { keywords: ["SALARIO", "FOLHA", "FGTS", "INSS", "DARF"], category: "Salários", type: "DEBIT" },
  { keywords: ["PIX RECEB", "RECEBIMENTO", "VENDAS", "CARTAO", "CIELO", "STONE", "PAGSEGURO", "MERCADO PAGO"], category: "Vendas", type: "CREDIT" },
];

export function OfxReconcileClient({
  pendingEntries,
  bankAccounts,
}: {
  pendingEntries: PendingEntry[];
  bankAccounts: BankAccount[];
}) {
  const [statement, setStatement] = useState<OfxParsedStatement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<number | "">(
    bankAccounts[0]?.id ?? "",
  );
  const [reconciledIds, setReconciledIds] = useState<string[]>([]);
  const [learnedRules, setLearnedRules] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [newEntryModalTrn, setNewEntryModalTrn] = useState<OfxTransaction | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ofx_category_rules_v1");
      if (raw) setLearnedRules(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    if (!newEntryModalTrn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNewEntryModalTrn(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newEntryModalTrn]);

  function normalizeRuleKey(memo: string) {
    return memo.toUpperCase().replace(/\d+/g, "").replace(/\s+/g, " ").trim().slice(0, 24);
  }

  function suggestCategory(trn: OfxTransaction): { category: string; matchedRule: boolean } {
    const upper = trn.memo.toUpperCase();
    const ruleKey = normalizeRuleKey(trn.memo);
    if (ruleKey && learnedRules[ruleKey]) {
      return { category: learnedRules[ruleKey], matchedRule: true };
    }
    for (const r of DEFAULT_OFX_RULES) {
      if (r.type && r.type !== trn.type) continue;
      if (r.keywords.some((k) => upper.includes(k))) {
        return { category: r.category, matchedRule: true };
      }
    }
    return {
      category: trn.type === "CREDIT" ? "Receitas Diversas / Vendas" : "Despesas Operacionais",
      matchedRule: false,
    };
  }

  function rememberRule(memo: string, category: string) {
    const key = normalizeRuleKey(memo);
    if (!key || !category.trim()) return;
    setLearnedRules((prev) => {
      const next = { ...prev, [key]: category.trim() };
      try {
        localStorage.setItem("ofx_category_rules_v1", JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingFile(true);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseOfx(text);
        setStatement(parsed);
      } catch (err) {
        alert("Erro ao ler o arquivo OFX. Verifique se o formato é válido.");
      } finally {
        setLoadingFile(false);
      }
    };
    reader.readAsText(file);
  }

  // Encontra a melhor correspondência no sistema para cada transação do extrato
  function findBestMatch(trn: OfxTransaction): MatchCandidate | null {
    const expectedType = trn.type === "CREDIT" ? "RECEITA" : "DESPESA";
    const trnTime = new Date(trn.date).getTime();

    // Filtra lançamentos pendentes que ainda não foram conciliados nesta sessão
    const available = pendingEntries.filter((p) => p.type === expectedType);

    let best: PendingEntry | null = null;
    let highestScore = 0;

    for (const p of available) {
      const diffAmount = Math.abs(p.amount - trn.amount);
      if (diffAmount < 0.05) {
        // Valor bate!
        const dueTime = new Date(p.dueDate).getTime();
        const dayDiff = Math.abs(trnTime - dueTime) / 86400000;

        let score = 90;
        if (dayDiff <= 3) score = 100;
        else if (dayDiff <= 10) score = 95;
        else if (dayDiff <= 30) score = 85;

        // Bônus se texto tiver similaridade
        if (p.description.toLowerCase().includes(trn.memo.toLowerCase().slice(0, 5))) {
          score += 5;
        }

        if (score > highestScore) {
          highestScore = score;
          best = p;
        }
      }
    }

    return best ? { entry: best, score: highestScore } : null;
  }

  function handleReconcileSingle(trnId: string, entryId: number, trnDate: Date) {
    startTransition(async () => {
      try {
        await reconcileExistingEntryAction(entryId, trnDate.toISOString());
        setReconciledIds((prev) => [...prev, trnId]);
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "Erro ao conciliar.");
      }
    });
  }

  function handleReconcileAllMatched() {
    if (!statement) return;
    const matches: { trnId: string; entryId: number; date: Date }[] = [];

    for (const trn of statement.transactions) {
      if (reconciledIds.includes(trn.id)) continue;
      const match = findBestMatch(trn);
      if (match && match.score >= 90) {
        matches.push({ trnId: trn.id, entryId: match.entry.id, date: trn.date });
      }
    }

    if (matches.length === 0) {
      alert("Nenhuma correspondência pendente encontrada para conciliação em lote.");
      return;
    }

    if (!confirm(`Deseja conciliar e dar baixa em lote em ${matches.length} lançamentos identificados?`)) {
      return;
    }

    startTransition(async () => {
      for (const m of matches) {
        try {
          await reconcileExistingEntryAction(m.entryId, m.date.toISOString());
          setReconciledIds((prev) => [...prev, m.trnId]);
        } catch {}
      }
      alert(`${matches.length} lançamentos conciliados com sucesso!`);
    });
  }

  function handleAutoCreateCategorized() {
    if (!statement) return;
    const autoItems = statement.transactions
      .filter((t) => !reconciledIds.includes(t.id) && findBestMatch(t) === null)
      .map((t) => ({ trn: t, suggestion: suggestCategory(t) }))
      .filter((x) => x.suggestion.matchedRule);

    if (autoItems.length === 0) {
      alert("Nenhuma transação nova correspondeu às regras automáticas de categorização.");
      return;
    }

    if (!confirm(`Lançar e baixar automaticamente ${autoItems.length} transação(ões) reconhecidas pelas regras bancárias?`)) {
      return;
    }

    startTransition(async () => {
      let okCount = 0;
      for (const { trn, suggestion } of autoItems) {
        try {
          const fd = new FormData();
          fd.set("type", trn.type);
          fd.set("description", trn.memo);
          fd.set("category", suggestion.category);
          fd.set("amount", String(trn.amount));
          fd.set("date", trn.date.toISOString());
          if (selectedBankId) fd.set("bankAccountId", String(selectedBankId));
          await createAndReconcileEntryAction(fd);
          setReconciledIds((prev) => [...prev, trn.id]);
          okCount++;
        } catch {}
      }
      alert(`${okCount} transação(ões) lançadas e conciliadas automaticamente!`);
    });
  }

  const items = statement?.transactions || [];
  const matchedCount = items.filter((t) => !reconciledIds.includes(t.id) && findBestMatch(t) !== null).length;
  const autoRuleCount = items.filter(
    (t) => !reconciledIds.includes(t.id) && findBestMatch(t) === null && suggestCategory(t).matchedRule,
  ).length;
  const newCount = items.filter((t) => !reconciledIds.includes(t.id) && findBestMatch(t) === null).length;
  const doneCount = reconciledIds.length;

  return (
    <div>
      {/* Card de Importação */}
      <div className="card mb">
        <h2 className="mb" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FileUp size={18} /> Carregar Extrato Bancário (.OFX)
        </h2>
        <p className="small muted mb">
          Acesse o Internet Banking do seu banco (Itaú, Bradesco, BB, Inter, Nubank, Santander, etc.), exporte o extrato em formato <strong>.OFX</strong> e anexe abaixo.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          <label className="btn" style={{ cursor: "pointer" }}>
            <Upload size={15} /> {loadingFile ? "Lendo arquivo..." : "Selecionar Arquivo .OFX"}
            <input
              type="file"
              accept=".ofx,.OFX"
              style={{ display: "none" }}
              onChange={handleFileUpload}
              disabled={loadingFile}
            />
          </label>

          {bankAccounts.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="small muted">Conta Bancária de Destino:</span>
              <select
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value ? Number(e.target.value) : "")}
                style={{ padding: "6px 10px", fontSize: 13, borderRadius: 6 }}
              >
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.bankName || "Banco"})
                  </option>
                ))}
              </select>
            </div>
          )}

          {fileName && (
            <div className="small" style={{ fontWeight: 600 }}>
              Arquivo selecionado: <span className="badge blue">{fileName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Resultados da Conciliação */}
      {statement && (
        <div className="card flush mb">
          <div
            style={{
              padding: "16px 18px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={18} /> Transações do Extrato ({items.length} encontradas)
              </h2>
              <div className="small muted" style={{ marginTop: 4 }}>
                {matchedCount} com correspondência automática no sistema · {newCount} novos lançamentos · {doneCount} já baixados
              </div>
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {matchedCount > 0 && (
                <button
                  type="button"
                  className="btn"
                  onClick={handleReconcileAllMatched}
                  disabled={isPending}
                >
                  <Sparkles size={14} /> Conciliar Todos os {matchedCount} Encontrados em 1 Clique
                </button>
              )}
              {autoRuleCount > 0 && (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={handleAutoCreateCategorized}
                  disabled={isPending}
                >
                  <RefreshCw size={14} /> Auto-Lançar {autoRuleCount} Categorizado(s) por Regra
                </button>
              )}
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Descrição no Banco (Extrato)</th>
                  <th className="num">Valor</th>
                  <th>Correspondência no Sistema</th>
                  <th className="actions">Ação</th>
                </tr>
              </thead>
              <tbody>
                {items.map((trn) => {
                  const isDone = reconciledIds.includes(trn.id);
                  const match = findBestMatch(trn);

                  return (
                    <tr key={trn.id} style={{ opacity: isDone ? 0.6 : 1 }}>
                      <td className="small">{fmtDate(trn.date)}</td>
                      <td>
                        <span className={`badge ${trn.type === "CREDIT" ? "green" : "red"}`}>
                          {trn.type === "CREDIT" ? "+ Entrada (Crédito)" : "- Saída (Débito)"}
                        </span>
                      </td>
                      <td className="bold" style={{ maxWidth: 280 }}>
                        {trn.memo}
                      </td>
                      <td className="num bold" style={{ fontSize: 14 }}>
                        {brl(trn.amount)}
                      </td>
                      <td>
                        {isDone ? (
                          <span className="badge green">
                            <Check size={11} /> Baixado com Sucesso
                          </span>
                        ) : match ? (
                          <div>
                            <span className="badge green" style={{ marginBottom: 4 }}>
                              <CheckCircle2 size={11} /> Match Encontrado ({match.score}%)
                            </span>
                            <div className="small bold">{match.entry.description}</div>
                            <div className="small muted">
                              Vencimento: {fmtDate(match.entry.dueDate)}
                              {match.entry.clientOrSupplier && ` · ${match.entry.clientOrSupplier}`}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="badge yellow">
                              <HelpCircle size={11} /> Não cadastrado no sistema
                            </span>
                            <div className="small muted">Não há conta com este valor exato em aberto</div>
                          </div>
                        )}
                      </td>
                      <td className="actions">
                        {isDone ? (
                          <span className="small muted">Conciliado</span>
                        ) : match ? (
                          <button
                            type="button"
                            className="btn sm"
                            disabled={isPending}
                            onClick={() => handleReconcileSingle(trn.id, match.entry.id, trn.date)}
                          >
                            <Check size={13} /> Conciliar (Dar Baixa)
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn sm secondary"
                            onClick={() => setNewEntryModalTrn(trn)}
                          >
                            <Plus size={13} /> Lançar & Baixar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal / Diálogo para Lançar Novo Registro Bancário não existente no sistema */}
      {newEntryModalTrn && (
        <div
          className="notifications-backdrop"
          onClick={() => setNewEntryModalTrn(null)}
          role="presentation"
        >
          <div
            className="card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ofx-modal-title"
            style={{ width: 480, maxWidth: "90vw", margin: "auto", animation: "loginFadeUp .15s ease" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="ofx-modal-title" className="mb" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Plus size={16} /> Lançar e Baixar Transação do Banco
            </h3>
            <p className="small muted mb">
              Esta transação consta no seu extrato bancário, mas não havia sido registrada no sistema. A categoria sugerida será memorizada para próximos extratos.
            </p>

            <form
              action={async (formData) => {
                try {
                  const chosenCat = String(formData.get("category") || "");
                  await createAndReconcileEntryAction(formData);
                  rememberRule(newEntryModalTrn.memo, chosenCat);
                  setReconciledIds((prev) => [...prev, newEntryModalTrn.id]);
                  setNewEntryModalTrn(null);
                } catch (err: unknown) {
                  alert(err instanceof Error ? err.message : "Erro ao lançar.");
                }
              }}
            >
              <input type="hidden" name="type" value={newEntryModalTrn.type} />
              <input type="hidden" name="amount" value={newEntryModalTrn.amount} />
              <input type="hidden" name="date" value={newEntryModalTrn.date.toISOString()} />
              <input type="hidden" name="bankAccountId" value={selectedBankId} />

              <div className="form-grid mb">
                <div className="field s12">
                  <label htmlFor="ofx-desc">Descrição do Lançamento *</label>
                  <input id="ofx-desc" name="description" defaultValue={newEntryModalTrn.memo} required />
                </div>
                <div className="field s6">
                  <label htmlFor="ofx-type">Tipo</label>
                  <input
                    id="ofx-type"
                    disabled
                    value={newEntryModalTrn.type === "CREDIT" ? "RECEITA (+ Entrada)" : "DESPESA (- Saída)"}
                  />
                </div>
                <div className="field s6">
                  <label htmlFor="ofx-val">Valor (R$)</label>
                  <input id="ofx-val" disabled value={brl(newEntryModalTrn.amount)} />
                </div>
                <div className="field s12">
                  <label htmlFor="ofx-cat">Categoria Contábil *</label>
                  <input
                    id="ofx-cat"
                    name="category"
                    defaultValue={suggestCategory(newEntryModalTrn).category}
                    required
                  />
                </div>
              </div>

              <div className="row end" style={{ gap: 8 }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setNewEntryModalTrn(null)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn">
                  <Check size={14} /> Confirmar Lançamento & Baixa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
