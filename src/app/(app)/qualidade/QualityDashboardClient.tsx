"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Plus,
  ShieldAlert,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import { fmtDate } from "@/lib/format";
import { AlertToast } from "@/components/AlertToast";
import {
  QUALITY_STATUS_LABEL,
  QUALITY_TYPES,
  RNC_SEVERITY_LABEL,
  RNC_STATUS_LABEL,
  parseChecklist,
  type QualityChecklistItem,
} from "@/lib/quality";
import {
  completeInspectionAction,
  createInspectionAction,
  createRncAction,
  updateRncAction,
} from "./actions";

export type InspectionRow = {
  id: number;
  code: string;
  type: string;
  title: string;
  productId: number | null;
  product: { id: number; name: string; sku: string } | null;
  referenceCode: string | null;
  batch: string | null;
  sampleSize: number;
  defectiveCount: number;
  checklistJson: string | null;
  status: string;
  inspectorName: string | null;
  notes: string | null;
  inspectedAt: string | null;
  createdAt: string;
};

export type RncRow = {
  id: number;
  code: string;
  title: string;
  origin: string;
  severity: string;
  status: string;
  inspectionId: number | null;
  inspection: { id: number; code: string; title: string } | null;
  productId: number | null;
  product: { id: number; name: string; sku: string } | null;
  description: string;
  rootCause: string | null;
  correctiveAction: string | null;
  responsibleName: string | null;
  dueDate: string | null;
  closedAt: string | null;
  createdAt: string;
};

export type TypeStat = {
  type: string;
  label: string;
  total: number;
  approved: number;
  rejected: number;
  rate: number;
};

const INSP_BADGE: Record<string, string> = {
  PENDENTE: "yellow",
  APROVADA: "green",
  APROVADA_RESSALVA: "blue",
  REPROVADA: "red",
};

const RNC_SEV_BADGE: Record<string, string> = {
  BAIXA: "gray",
  MEDIA: "blue",
  ALTA: "yellow",
  CRITICA: "red",
};

const RNC_STATUS_BADGE: Record<string, string> = {
  ABERTA: "red",
  EM_ANALISE: "yellow",
  ACAO_CORRETIVA: "blue",
  VERIFICACAO: "purple",
  ENCERRADA: "green",
};

export function QualityDashboardClient({
  inspections,
  rncs,
  products,
  byType,
  initialTab = "inspecoes",
}: {
  inspections: InspectionRow[];
  rncs: RncRow[];
  products: { id: number; name: string; sku: string }[];
  byType: TypeStat[];
  initialTab?: string;
}) {
  const [tab, setTab] = useState<"inspecoes" | "rncs" | "indicadores">(
    initialTab === "rncs" ? "rncs" : initialTab === "indicadores" ? "indicadores" : "inspecoes",
  );

  useEffect(() => {
    setTab(initialTab === "rncs" ? "rncs" : initialTab === "indicadores" ? "indicadores" : "inspecoes");
  }, [initialTab]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Modais
  const [newInspOpen, setNewInspOpen] = useState(false);
  const [activeInsp, setActiveInsp] = useState<InspectionRow | null>(null);
  const [checklistItems, setChecklistItems] = useState<QualityChecklistItem[]>([]);
  const [sampleSizeInput, setSampleSizeInput] = useState(1);
  const [defectiveInput, setDefectiveInput] = useState(0);
  const [inspNotesInput, setInspNotesInput] = useState("");

  const [newRncOpen, setNewRncOpen] = useState(false);
  const [editingRnc, setEditingRnc] = useState<RncRow | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNewInspOpen(false);
        setActiveInsp(null);
        setNewRncOpen(false);
        setEditingRnc(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function openInspectionChecklist(row: InspectionRow) {
    setActiveInsp(row);
    setChecklistItems(parseChecklist(row.checklistJson, row.type));
    setSampleSizeInput(row.sampleSize || 1);
    setDefectiveInput(row.defectiveCount || 0);
    setInspNotesInput(row.notes || "");
  }

  const filteredInspections = useMemo(() => {
    return inspections.filter((i) => {
      if (statusFilter && i.status !== statusFilter) return false;
      if (typeFilter && i.type !== typeFilter) return false;
      return true;
    });
  }, [inspections, statusFilter, typeFilter]);

  function submitChecklistDecision(status: "APROVADA" | "APROVADA_RESSALVA" | "REPROVADA") {
    if (!activeInsp) return;
    startTransition(async () => {
      try {
        const res = await completeInspectionAction({
          id: activeInsp.id,
          status,
          sampleSize: sampleSizeInput,
          defectiveCount: defectiveInput,
          checklist: checklistItems,
          notes: inspNotesInput,
        });
        setActiveInsp(null);
        setFeedback({
          type: "ok",
          text: res.autoRncCode
            ? `Inspeção concluída como REPROVADA. RNC ${res.autoRncCode} foi aberta automaticamente para tratativa!`
            : `Inspeção ${activeInsp.code} atualizada para ${QUALITY_STATUS_LABEL[status]}.`,
        });
      } catch (err: unknown) {
        setFeedback({ type: "error", text: err instanceof Error ? err.message : "Erro ao salvar inspeção." });
      }
    });
  }

  function exportQualityCsv() {
    const lines = [
      ["Tipo", "Código", "Título", "Referência", "Produto", "Status", "Amostra", "Defeitos", "Data"].join(";"),
      ...inspections.map((i) =>
        [
          i.type,
          i.code,
          `"${i.title.replace(/"/g, '""')}"`,
          i.referenceCode || "",
          i.product ? `"${i.product.name.replace(/"/g, '""')}"` : "",
          QUALITY_STATUS_LABEL[i.status] ?? i.status,
          String(i.sampleSize),
          String(i.defectiveCount),
          fmtDate(i.inspectedAt || i.createdAt),
        ].join(";"),
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-qualidade-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div>
      {feedback && (
        <AlertToast
          type={feedback.type === "ok" ? "success" : "error"}
          message={feedback.text}
        />
      )}

      {/* Barra de Abas + Ações */}
      <div className="row between mb" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="row" role="tablist" aria-label="Seções da Gestão da Qualidade" style={{ gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "inspecoes"}
            className={`btn sm ${tab === "inspecoes" ? "" : "secondary"}`}
            onClick={() => setTab("inspecoes")}
          >
            <ClipboardCheck size={14} /> Inspeções & Checklists ({inspections.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "rncs"}
            className={`btn sm ${tab === "rncs" ? "" : "secondary"}`}
            onClick={() => setTab("rncs")}
          >
            <ShieldAlert size={14} /> Não Conformidades — RNC ({rncs.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "indicadores"}
            className={`btn sm ${tab === "indicadores" ? "" : "secondary"}`}
            onClick={() => setTab("indicadores")}
          >
            <Award size={14} /> Indicadores & Padrões
          </button>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn sm secondary" onClick={exportQualityCsv}>
            <Download size={14} /> Exportar CSV
          </button>
          <button type="button" className="btn sm secondary" onClick={() => setNewRncOpen(true)}>
            <AlertTriangle size={14} /> Abrir RNC Manual
          </button>
          <button type="button" className="btn sm" onClick={() => setNewInspOpen(true)}>
            <Plus size={14} /> Nova Inspeção
          </button>
        </div>
      </div>

      {/* ABA 1: INSPEÇÕES */}
      {tab === "inspecoes" && (
        <div className="card flush">
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }} className="row between">
            <div>
              <h2 style={{ margin: 0 }}>Fila de Inspeções de Qualidade</h2>
              <div className="small muted">
                Recebimentos e Ordens de Produção concluídas geram inspeções automáticas. Reprovar abre RNC automática.
              </div>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <select
                aria-label="Filtrar por tipo de inspeção"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{ width: "auto", minWidth: 160 }}
              >
                <option value="">Todos os tipos</option>
                {QUALITY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filtrar por status da inspeção"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: "auto", minWidth: 150 }}
              >
                <option value="">Todos os status</option>
                {Object.entries(QUALITY_STATUS_LABEL).map(([k, lbl]) => (
                  <option key={k} value={k}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Tipo</th>
                  <th>Inspeção / Lote</th>
                  <th>Produto</th>
                  <th className="num">Amostra / Defeitos</th>
                  <th>Status</th>
                  <th className="actions">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filteredInspections.map((row) => (
                  <tr key={row.id}>
                    <td className="bold">{row.code}</td>
                    <td>
                      <span className="badge gray">{row.type}</span>
                    </td>
                    <td>
                      <div className="bold">{row.title}</div>
                      <div className="small muted">
                        {row.referenceCode ? `Ref: ${row.referenceCode}` : "Inspeção avulsa"}
                        {row.batch ? ` · Lote ${row.batch}` : ""}
                        {row.inspectorName ? ` · Inspetor: ${row.inspectorName}` : ""}
                      </div>
                    </td>
                    <td className="small">{row.product ? `${row.product.name} (${row.product.sku})` : "—"}</td>
                    <td className="num">
                      {row.sampleSize} un ·{" "}
                      <strong style={{ color: row.defectiveCount > 0 ? "#ef4444" : undefined }}>
                        {row.defectiveCount} def.
                      </strong>
                    </td>
                    <td>
                      <span className={`badge ${INSP_BADGE[row.status] ?? "gray"}`}>
                        {QUALITY_STATUS_LABEL[row.status] ?? row.status}
                      </span>
                    </td>
                    <td className="actions">
                      <button
                        type="button"
                        className={`btn sm ${row.status === "PENDENTE" ? "" : "secondary"}`}
                        onClick={() => openInspectionChecklist(row)}
                      >
                        <ClipboardCheck size={13} /> {row.status === "PENDENTE" ? "Inspecionar" : "Ver Checklist"}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredInspections.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty">
                      Nenhuma inspeção de qualidade encontrada. Crie uma nova ou registre um recebimento/produção.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 2: RNC & CAPA */}
      {tab === "rncs" && (
        <div className="card flush">
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ margin: 0 }}>Relatórios de Não Conformidade (RNC) & Plano CAPA</h2>
            <div className="small muted">
              Registre causa raiz (5 Porquês), ação corretiva, responsável e acompanhe prazos de encerramento.
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Ocorrência / Origem</th>
                  <th>Severidade</th>
                  <th>Responsável & Prazo</th>
                  <th>Status</th>
                  <th className="actions">Ação</th>
                </tr>
              </thead>
              <tbody>
                {rncs.map((r) => {
                  const overdue = r.status !== "ENCERRADA" && r.dueDate && r.dueDate.slice(0, 10) < todayIso;
                  return (
                    <tr key={r.id}>
                      <td className="bold">{r.code}</td>
                      <td>
                        <div className="bold">{r.title}</div>
                        <div className="small muted">
                          Origem: {r.origin}
                          {r.inspection ? ` · ${r.inspection.code}` : ""}
                          {r.product ? ` · ${r.product.name}` : ""}
                        </div>
                        {r.rootCause && (
                          <div className="small" style={{ marginTop: 4 }}>
                            <strong>Causa raiz:</strong> {r.rootCause}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${RNC_SEV_BADGE[r.severity] ?? "gray"}`}>
                          {RNC_SEVERITY_LABEL[r.severity] ?? r.severity}
                        </span>
                      </td>
                      <td className="small">
                        <div>{r.responsibleName || "Não atribuído"}</div>
                        <div className={overdue ? "bold" : "muted"}>
                          {r.dueDate ? `Prazo: ${fmtDate(r.dueDate)}` : "Sem prazo"}
                          {overdue && " (VENCIDA)"}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${RNC_STATUS_BADGE[r.status] ?? "gray"}`}>
                          {RNC_STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="actions">
                        <button type="button" className="btn sm secondary" onClick={() => setEditingRnc(r)}>
                          <Wrench size={13} /> Tratar CAPA
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {rncs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">
                      Nenhuma Não Conformidade registrada até o momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 3: INDICADORES */}
      {tab === "indicadores" && (
        <div className="grid grid-2" style={{ gap: 16 }}>
          <div className="card">
            <h2 className="mb">Desempenho por Etapa / Tipo de Inspeção</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th className="num">Concluídas</th>
                    <th className="num">Aprovadas</th>
                    <th className="num">Reprovadas</th>
                    <th className="num">Aprovação</th>
                  </tr>
                </thead>
                <tbody>
                  {byType.map((s) => (
                    <tr key={s.type}>
                      <td className="bold">{s.label}</td>
                      <td className="num">{s.total}</td>
                      <td className="num">{s.approved}</td>
                      <td className="num">{s.rejected}</td>
                      <td className="num">
                        <span className={`badge ${s.rate >= 90 ? "green" : s.rate >= 70 ? "yellow" : "red"}`}>
                          {s.rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2 className="mb">Automações Ativas da Qualidade (SGQ)</h2>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.75 }}>
              <li>
                <strong>Recebimento de Materiais:</strong> toda entrada em <code>/recebimento</code> cria uma inspeção pendente para conferência antes da liberação.
              </li>
              <li>
                <strong>Chão de Fábrica (OP):</strong> ao concluir uma Ordem de Produção em <code>/producao</code>, o sistema cria automaticamente a inspeção de lote acabado.
              </li>
              <li>
                <strong>Abertura Automática de RNC:</strong> reprovar um checklist gera imediatamente uma RNC com severidade proporcional ao percentual de defeitos.
              </li>
              <li>
                <strong>Alertas & Cron Diário:</strong> inspeções pendentes e RNCs com prazo vencido aparecem na Central de Notificações e no resumo diário.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* MODAL: NOVA INSPEÇÃO */}
      {newInspOpen && (
        <div className="notifications-backdrop" role="presentation" onClick={() => setNewInspOpen(false)}>
          <div
            className="card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-new-insp-title"
            style={{ width: 520, maxWidth: "92vw", margin: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row between mb">
              <h3 id="modal-new-insp-title">Nova Inspeção de Qualidade</h3>
              <button
                type="button"
                className="cmd-close"
                aria-label="Fechar modal"
                onClick={() => setNewInspOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <form
              action={async (fd) => {
                try {
                  await createInspectionAction(fd);
                  setNewInspOpen(false);
                  setFeedback({ type: "ok", text: "Inspeção de qualidade criada com checklist padrão!" });
                } catch (err: unknown) {
                  setFeedback({ type: "error", text: err instanceof Error ? err.message : "Erro ao criar inspeção." });
                }
              }}
            >
              <div className="form-grid mb">
                <div className="field s6">
                  <label htmlFor="insp-type">Tipo *</label>
                  <select id="insp-type" name="type" defaultValue="PRODUCAO">
                    {QUALITY_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field s6">
                  <label htmlFor="insp-sample">Tamanho da Amostra *</label>
                  <input id="insp-sample" name="sampleSize" type="number" min={1} defaultValue={5} required />
                </div>
                <div className="field s12">
                  <label htmlFor="insp-title">Título da Inspeção *</label>
                  <input id="insp-title" name="title" placeholder="Ex: Conferência Lote Peça X / Auditoria 5S" required />
                </div>
                <div className="field s6">
                  <label htmlFor="insp-product">Produto (opcional)</label>
                  <select id="insp-product" name="productId" defaultValue="">
                    <option value="">Sem vínculo específico</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field s6">
                  <label htmlFor="insp-batch">Lote / Referência</label>
                  <input id="insp-batch" name="batch" placeholder="Ex: LOTE-2026-A" />
                </div>
                <div className="field s12">
                  <label htmlFor="insp-notes">Observações</label>
                  <textarea id="insp-notes" name="notes" rows={2} />
                </div>
              </div>
              <div className="row end" style={{ gap: 8 }}>
                <button type="button" className="btn secondary" onClick={() => setNewInspOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn" disabled={isPending}>
                  Criar Inspeção
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EXECUTAR CHECKLIST DA INSPEÇÃO */}
      {activeInsp && (
        <div className="notifications-backdrop" role="presentation" onClick={() => setActiveInsp(null)}>
          <div
            className="card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-checklist-title"
            style={{ width: 620, maxWidth: "94vw", maxHeight: "90vh", overflowY: "auto", margin: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row between mb">
              <div>
                <h3 id="modal-checklist-title">
                  {activeInsp.code} — {activeInsp.title}
                </h3>
                <div className="small muted">
                  Tipo: {activeInsp.type} {activeInsp.referenceCode ? `· Ref: ${activeInsp.referenceCode}` : ""}
                </div>
              </div>
              <button
                type="button"
                className="cmd-close"
                aria-label="Fechar checklist"
                onClick={() => setActiveInsp(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="form-grid mb">
              <div className="field s6">
                <label htmlFor="chk-sample">Qtd. Amostrada</label>
                <input
                  id="chk-sample"
                  type="number"
                  min={1}
                  value={sampleSizeInput}
                  onChange={(e) => setSampleSizeInput(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
              <div className="field s6">
                <label htmlFor="chk-defective">Itens com Defeito</label>
                <input
                  id="chk-defective"
                  type="number"
                  min={0}
                  max={sampleSizeInput}
                  value={defectiveInput}
                  onChange={(e) => setDefectiveInput(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
            </div>

            <div className="mb">
              <div className="bold small mb">Checklist de Verificação</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {checklistItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 10,
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      background: "var(--surface-subtle)",
                    }}
                  >
                    <label className="checkbox" style={{ cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={item.ok}
                        onChange={(e) => {
                          const next = [...checklistItems];
                          next[idx] = { ...next[idx], ok: e.target.checked };
                          setChecklistItems(next);
                        }}
                      />
                      <span>{item.label}</span>
                    </label>
                    <input
                      aria-label={`Observação para ${item.label}`}
                      placeholder="Observação do critério (opcional)..."
                      value={item.note ?? ""}
                      onChange={(e) => {
                        const next = [...checklistItems];
                        next[idx] = { ...next[idx], note: e.target.value };
                        setChecklistItems(next);
                      }}
                      style={{ marginTop: 6, fontSize: 12.5, padding: "5px 8px" }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="field mb">
              <label htmlFor="chk-notes">Parecer Técnico / Laudo</label>
              <textarea
                id="chk-notes"
                rows={2}
                value={inspNotesInput}
                onChange={(e) => setInspNotesInput(e.target.value)}
              />
            </div>

            <div className="row end" style={{ gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn danger"
                disabled={isPending}
                onClick={() => submitChecklistDecision("REPROVADA")}
              >
                <XCircle size={14} /> Reprovar (Abre RNC)
              </button>
              <button
                type="button"
                className="btn secondary"
                disabled={isPending}
                onClick={() => submitChecklistDecision("APROVADA_RESSALVA")}
              >
                Aprovar c/ Ressalva
              </button>
              <button
                type="button"
                className="btn"
                disabled={isPending}
                onClick={() => submitChecklistDecision("APROVADA")}
              >
                <CheckCircle2 size={14} /> Aprovar Lote
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVA RNC MANUAL */}
      {newRncOpen && (
        <div className="notifications-backdrop" role="presentation" onClick={() => setNewRncOpen(false)}>
          <div
            className="card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-new-rnc-title"
            style={{ width: 540, maxWidth: "92vw", margin: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row between mb">
              <h3 id="modal-new-rnc-title">Abrir Relatório de Não Conformidade (RNC)</h3>
              <button
                type="button"
                className="cmd-close"
                aria-label="Fechar modal"
                onClick={() => setNewRncOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <form
              action={async (fd) => {
                try {
                  await createRncAction(fd);
                  setNewRncOpen(false);
                  setTab("rncs");
                  setFeedback({ type: "ok", text: "RNC aberta com sucesso para análise CAPA!" });
                } catch (err: unknown) {
                  setFeedback({ type: "error", text: err instanceof Error ? err.message : "Erro ao abrir RNC." });
                }
              }}
            >
              <div className="form-grid mb">
                <div className="field s12">
                  <label htmlFor="rnc-title">Título da Não Conformidade *</label>
                  <input id="rnc-title" name="title" required placeholder="Ex: Embalagem avariada / Desvio dimensional" />
                </div>
                <div className="field s6">
                  <label htmlFor="rnc-origin">Origem</label>
                  <select id="rnc-origin" name="origin" defaultValue="INTERNA">
                    <option value="INSPECAO">Inspeção</option>
                    <option value="RECEBIMENTO">Recebimento</option>
                    <option value="PRODUCAO">Produção</option>
                    <option value="CLIENTE">Reclamação de Cliente</option>
                    <option value="INTERNA">Auditoria / Interna</option>
                  </select>
                </div>
                <div className="field s6">
                  <label htmlFor="rnc-severity">Severidade</label>
                  <select id="rnc-severity" name="severity" defaultValue="MEDIA">
                    <option value="BAIXA">Baixa</option>
                    <option value="MEDIA">Média</option>
                    <option value="ALTA">Alta</option>
                    <option value="CRITICA">Crítica</option>
                  </select>
                </div>
                <div className="field s6">
                  <label htmlFor="rnc-resp">Responsável</label>
                  <input id="rnc-resp" name="responsibleName" placeholder="Nome do responsável" />
                </div>
                <div className="field s6">
                  <label htmlFor="rnc-due">Prazo Limite</label>
                  <input id="rnc-due" name="dueDate" type="date" />
                </div>
                <div className="field s12">
                  <label htmlFor="rnc-desc">Descrição do Problema *</label>
                  <textarea id="rnc-desc" name="description" rows={3} required />
                </div>
              </div>
              <div className="row end" style={{ gap: 8 }}>
                <button type="button" className="btn secondary" onClick={() => setNewRncOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn">
                  Registrar RNC
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TRATAR CAPA DE RNC */}
      {editingRnc && (
        <div className="notifications-backdrop" role="presentation" onClick={() => setEditingRnc(null)}>
          <div
            className="card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-edit-rnc-title"
            style={{ width: 580, maxWidth: "92vw", maxHeight: "90vh", overflowY: "auto", margin: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row between mb">
              <h3 id="modal-edit-rnc-title">
                {editingRnc.code} — Tratativa CAPA
              </h3>
              <button
                type="button"
                className="cmd-close"
                aria-label="Fechar modal"
                onClick={() => setEditingRnc(null)}
              >
                <X size={16} />
              </button>
            </div>
            <p className="small muted mb">{editingRnc.description}</p>
            <form
              action={async (fd) => {
                try {
                  await updateRncAction(fd);
                  setEditingRnc(null);
                  setFeedback({ type: "ok", text: `RNC ${editingRnc.code} atualizada!` });
                } catch (err: unknown) {
                  setFeedback({ type: "error", text: err instanceof Error ? err.message : "Erro ao atualizar RNC." });
                }
              }}
            >
              <input type="hidden" name="id" value={editingRnc.id} />
              <div className="form-grid mb">
                <div className="field s6">
                  <label htmlFor="edit-rnc-status">Etapa / Status</label>
                  <select id="edit-rnc-status" name="status" defaultValue={editingRnc.status}>
                    {Object.entries(RNC_STATUS_LABEL).map(([k, lbl]) => (
                      <option key={k} value={k}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field s6">
                  <label htmlFor="edit-rnc-sev">Severidade</label>
                  <select id="edit-rnc-sev" name="severity" defaultValue={editingRnc.severity}>
                    {Object.entries(RNC_SEVERITY_LABEL).map(([k, lbl]) => (
                      <option key={k} value={k}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field s6">
                  <label htmlFor="edit-rnc-resp">Responsável</label>
                  <input id="edit-rnc-resp" name="responsibleName" defaultValue={editingRnc.responsibleName || ""} />
                </div>
                <div className="field s6">
                  <label htmlFor="edit-rnc-due">Prazo</label>
                  <input
                    id="edit-rnc-due"
                    name="dueDate"
                    type="date"
                    defaultValue={editingRnc.dueDate ? editingRnc.dueDate.slice(0, 10) : ""}
                  />
                </div>
                <div className="field s12">
                  <label htmlFor="edit-rnc-root">Causa Raiz (5 Porquês / Ishikawa)</label>
                  <textarea id="edit-rnc-root" name="rootCause" rows={2} defaultValue={editingRnc.rootCause || ""} />
                </div>
                <div className="field s12">
                  <label htmlFor="edit-rnc-capa">Plano de Ação Corretiva / Preventiva (CAPA)</label>
                  <textarea
                    id="edit-rnc-capa"
                    name="correctiveAction"
                    rows={3}
                    defaultValue={editingRnc.correctiveAction || ""}
                  />
                </div>
              </div>
              <div className="row end" style={{ gap: 8 }}>
                <button type="button" className="btn secondary" onClick={() => setEditingRnc(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn">
                  Salvar Tratativa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
