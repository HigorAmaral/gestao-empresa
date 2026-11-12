"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Eye,
  MessageCircle,
  Phone,
  Sparkles,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { brl, fmtDate } from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { updateSaleStageAction } from "./actions";

export interface OpportunityItem {
  id: number;
  stage: string;
  total: number;
  status: string;
  date: string;
  notes?: string | null;
  client: {
    id: number;
    name: string;
    phone?: string | null;
  } | null;
}

const STAGES = [
  { id: "NOVO_LEAD", label: "Novo Lead", color: "gray" },
  { id: "CONTATO", label: "Contato Feito", color: "blue" },
  { id: "PROPOSTA", label: "Proposta Enviada", color: "yellow" },
  { id: "NEGOCIACAO", label: "Em Negociação", color: "purple" },
  { id: "FECHADO", label: "Fechado / Ganho", color: "green" },
] as const;

export function CrmPipelineView({ opportunities }: { opportunities: OpportunityItem[] }) {
  const [items, setItems] = useState<OpportunityItem[]>(opportunities);
  const [isPending, startTransition] = useTransition();
  const [lossModalId, setLossModalId] = useState<number | null>(null);
  const [lossReason, setLossReason] = useState("");

  function moveStage(saleId: number, targetStage: string, reason?: string) {
    // Atualização otimista
    setItems((prev) =>
      prev.map((it) => (it.id === saleId ? { ...it, stage: targetStage } : it)),
    );

    startTransition(async () => {
      try {
        await updateSaleStageAction(saleId, targetStage, reason);
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "Erro ao mover oportunidade.");
      }
    });
  }

  function getNextStage(curStage: string): string | null {
    const idx = STAGES.findIndex((s) => s.id === curStage);
    if (idx >= 0 && idx < STAGES.length - 1) {
      return STAGES[idx + 1].id;
    }
    return null;
  }

  function getPrevStage(curStage: string): string | null {
    const idx = STAGES.findIndex((s) => s.id === curStage);
    if (idx > 0) {
      return STAGES[idx - 1].id;
    }
    return null;
  }

  return (
    <div>
      {/* Board Kanban Horizontal com Scroll */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(240px, 1fr))",
          gap: 12,
          overflowX: "auto",
          paddingBottom: 16,
        }}
      >
        {STAGES.map((stage) => {
          const stageItems = items.filter((it) => it.stage === stage.id);
          const stageTotal = stageItems.reduce((s, it) => s + it.total, 0);

          return (
            <div
              key={stage.id}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                display: "flex",
                flexDirection: "column",
                minHeight: 460,
              }}
            >
              {/* Header da Coluna */}
              <div
                style={{
                  padding: "12px 14px",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--surface-subtle)",
                  borderRadius: "8px 8px 0 0",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: 13 }}>{stage.label}</strong>
                  <span className={`badge ${stage.color}`}>{stageItems.length}</span>
                </div>
                <div className="small muted" style={{ marginTop: 4, fontWeight: 600 }}>
                  {brl(stageTotal)}
                </div>
              </div>

              {/* Lista de Cards da Etapa */}
              <div
                style={{
                  padding: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  flex: 1,
                  overflowY: "auto",
                }}
              >
                {stageItems.map((item) => {
                  const clientName = item.client?.name || "Consumidor";
                  const phone = item.client?.phone;
                  const waMsg = `Olá, *${clientName}*! Tudo bem? Entrando em contato sobre sua proposta #${item.id} na nossa empresa.`;
                  const waUrl = buildWhatsAppUrl(phone, waMsg);

                  const prev = getPrevStage(item.stage);
                  const next = getNextStage(item.stage);

                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: 12,
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "var(--surface)",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Link
                          href={`/vendas/${item.id}`}
                          className="bold"
                          style={{ fontSize: 13, textDecoration: "none", color: "var(--text)" }}
                        >
                          {clientName}
                        </Link>
                        <span className="small muted">#{item.id}</span>
                      </div>

                      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>
                        {brl(item.total)}
                      </div>

                      {item.notes && (
                        <div
                          className="small muted"
                          style={{
                            fontSize: 11.5,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={item.notes}
                        >
                          {item.notes}
                        </div>
                      )}

                      <div className="small muted" style={{ fontSize: 11 }}>
                        {fmtDate(item.date)}
                      </div>

                      {/* Botões de Ação do Card */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: 6,
                          paddingTop: 6,
                          borderTop: "1px solid var(--border)",
                        }}
                      >
                        <div style={{ display: "flex", gap: 4 }}>
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn xs secondary"
                              title="Conversar no WhatsApp"
                              style={{ padding: "2px 6px" }}
                            >
                              <MessageCircle size={12} />
                            </a>
                          )}
                          <Link
                            href={`/vendas/${item.id}`}
                            className="btn xs secondary"
                            title="Ver Proposta Completa"
                            style={{ padding: "2px 6px" }}
                          >
                            <Eye size={12} />
                          </Link>
                          {item.stage !== "FECHADO" && (
                            <button
                              type="button"
                              className="btn xs secondary"
                              title="Marcar como Perdido"
                              style={{ padding: "2px 6px" }}
                              onClick={() => setLossModalId(item.id)}
                            >
                              <XCircle size={12} />
                            </button>
                          )}
                        </div>

                        {/* Setas para mover de estágio */}
                        <div style={{ display: "flex", gap: 3 }}>
                          {prev && (
                            <button
                              type="button"
                              className="btn xs secondary"
                              style={{ padding: "2px 6px" }}
                              title="Voltar etapa anterior"
                              disabled={isPending}
                              onClick={() => moveStage(item.id, prev)}
                            >
                              <ArrowLeft size={11} />
                            </button>
                          )}
                          {next && (
                            <button
                              type="button"
                              className="btn xs"
                              style={{ padding: "2px 6px" }}
                              title="Avançar próxima etapa"
                              disabled={isPending}
                              onClick={() => moveStage(item.id, next)}
                            >
                              <ArrowRight size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {stageItems.length === 0 && (
                  <div className="small muted" style={{ textAlign: "center", padding: 20 }}>
                    Nenhuma oportunidade nesta etapa.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal para Informar Motivo da Perda */}
      {lossModalId && (
        <div className="notifications-backdrop" onClick={() => setLossModalId(null)}>
          <div
            className="card"
            style={{ width: 420, maxWidth: "90vw", margin: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <XCircle size={16} /> Marcar Oportunidade como Perdida
            </h3>
            <p className="small muted mb">
              Informe o motivo para gerar estatísticas comerciais da equipe e entender por que a proposta não fechou.
            </p>

            <div className="field mb">
              <label>Motivo da Perda *</label>
              <select
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                style={{ width: "100%", padding: 8, borderRadius: 6 }}
              >
                <option value="">Selecione um motivo...</option>
                <option value="Preço muito alto / Concorrência mais barata">Preço / Concorrente mais barato</option>
                <option value="Prazo de entrega não atendeu">Prazo de entrega muito longo</option>
                <option value="Cliente desistiu do projeto/compra">Cliente desistiu do projeto</option>
                <option value="Sem retorno do cliente após várias tentativas">Sem contato / Cliente sumiu</option>
                <option value="Falta de produto em estoque">Falta de produto no estoque</option>
                <option value="Outro motivo">Outro motivo</option>
              </select>
            </div>

            <div className="row end" style={{ gap: 8 }}>
              <button type="button" className="btn secondary" onClick={() => setLossModalId(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  moveStage(lossModalId, "PERDIDO", lossReason || "Outro motivo");
                  setLossModalId(null);
                  setLossReason("");
                }}
              >
                Confirmar Perda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
