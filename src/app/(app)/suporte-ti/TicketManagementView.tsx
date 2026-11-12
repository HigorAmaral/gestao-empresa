"use client";

import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Headphones,
  LifeBuoy,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Send,
  Ticket,
  Trash2,
  User,
  Wrench,
  X,
} from "lucide-react";
import { updateTicketStatusAction, deleteTicketAction } from "./actions";

interface TicketItem {
  id: number;
  ticketNumber: string;
  requesterName: string;
  requesterEmail?: string | null;
  requesterPhone?: string | null;
  department?: string | null;
  category: string;
  priority: string;
  status: string;
  title: string;
  description: string;
  solutionNotes?: string | null;
  assignedTo?: string | null;
  resolvedAt?: string | Date | null;
  createdAt: string | Date;
}

interface TicketMetrics {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
}

export function TicketManagementView({
  initialTickets,
  metrics,
  userName,
  isAdmin,
}: {
  initialTickets: TicketItem[];
  metrics: TicketMetrics;
  userName: string;
  isAdmin: boolean;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [priorityFilter, setPriorityFilter] = useState("TODOS");
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [activeModal, setActiveModal] = useState<"action" | "details" | null>(null);

  // Campos do modal de resolução
  const [newStatus, setNewStatus] = useState("EM_ATENDIMENTO");
  const [solutionNotes, setSolutionNotes] = useState("");
  const [assignedTo, setAssignedTo] = useState(userName);
  const [isSaving, setIsSaving] = useState(false);

  // Filtragem dos chamados
  const filteredTickets = initialTickets.filter((t) => {
    if (statusFilter !== "TODOS" && t.status !== statusFilter) return false;
    if (priorityFilter !== "TODOS" && t.priority !== priorityFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const match =
        t.ticketNumber.toLowerCase().includes(q) ||
        t.requesterName.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        (t.department && t.department.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const openActionModal = (ticket: TicketItem) => {
    setSelectedTicket(ticket);
    setNewStatus(ticket.status === "ABERTO" ? "EM_ATENDIMENTO" : ticket.status);
    setSolutionNotes(ticket.solutionNotes || "");
    setAssignedTo(ticket.assignedTo || userName);
    setActiveModal("action");
  };

  const openDetailsModal = (ticket: TicketItem) => {
    setSelectedTicket(ticket);
    setActiveModal("details");
  };

  const handleSaveAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setIsSaving(true);
    try {
      const fd = new FormData();
      fd.set("id", String(selectedTicket.id));
      fd.set("status", newStatus);
      fd.set("solutionNotes", solutionNotes);
      fd.set("assignedTo", assignedTo);
      await updateTicketStatusAction(fd);
      setActiveModal(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Confirma a exclusão deste chamado da base de TI?")) return;
    const fd = new FormData();
    fd.set("id", String(id));
    await deleteTicketAction(fd);
    if (selectedTicket?.id === id) setActiveModal(null);
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "URGENTE":
        return <span className="badge danger">🔴 Urgente</span>;
      case "ALTA":
        return <span className="badge warning">🟠 Alta</span>;
      case "BAIXA":
        return <span className="badge info">🟢 Baixa</span>;
      case "NORMAL":
      default:
        return <span className="badge neutral">⚪ Normal</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ABERTO":
        return <span className="badge danger">Novo / Aberto</span>;
      case "EM_ATENDIMENTO":
        return <span className="badge warning">Em Atendimento</span>;
      case "RESOLVIDO":
        return <span className="badge success">Resolvido</span>;
      case "CANCELADO":
        return <span className="badge neutral">Cancelado</span>;
      default:
        return <span className="badge neutral">{status}</span>;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "ACESSO_SENHA":
        return "🔑 Senha / Acesso";
      case "SISTEMA_ERRO":
        return "⚙️ Erro no Sistema";
      case "EQUIPAMENTO_HARDWARE":
        return "💻 Computador / Impressora";
      case "REDE_INTERNET":
        return "🌐 Rede / Internet";
      case "INSTALACAO_SOFTWARE":
        return "📋 Instalação de Software";
      default:
        return "❓ Outro Assunto";
    }
  };

  return (
    <div>
      {/* Cards de Métricas Principais */}
      <div className="stats mb">
        <div className="stat">
          <div className="label">Total de Chamados</div>
          <div className="value">{metrics.total}</div>
        </div>
        <div className="stat" style={{ borderLeft: "4px solid #ef4444" }}>
          <div className="label">Novos / Abertos</div>
          <div className="value" style={{ color: "#ef4444" }}>
            {metrics.open}
          </div>
        </div>
        <div className="stat" style={{ borderLeft: "4px solid #f59e0b" }}>
          <div className="label">Em Atendimento</div>
          <div className="value" style={{ color: "#f59e0b" }}>
            {metrics.inProgress}
          </div>
        </div>
        <div className="stat" style={{ borderLeft: "4px solid #10b981" }}>
          <div className="label">Resolvidos / Concluídos</div>
          <div className="value" style={{ color: "#10b981" }}>
            {metrics.resolved}
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="card mb">
        <div className="row" style={{ gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240, position: "relative" }}>
            <Search
              size={16}
              style={{ position: "absolute", left: 12, top: 12, color: "var(--muted)" }}
            />
            <input
              type="text"
              placeholder="Buscar por protocolo, solicitante, departamento ou assunto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 36, width: "100%" }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ minWidth: 150 }}
            >
              <option value="TODOS">Todos os Status</option>
              <option value="ABERTO">Novos / Abertos</option>
              <option value="EM_ATENDIMENTO">Em Atendimento</option>
              <option value="RESOLVIDO">Resolvidos</option>
              <option value="CANCELADO">Cancelados</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              style={{ minWidth: 140 }}
            >
              <option value="TODOS">Todas Prioridades</option>
              <option value="URGENTE">Urgente</option>
              <option value="ALTA">Alta</option>
              <option value="NORMAL">Normal</option>
              <option value="BAIXA">Baixa</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Chamados */}
      <div className="card">
        {filteredTickets.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px" }}>
            <Headphones size={42} style={{ color: "var(--muted)", marginBottom: 12 }} />
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
              Nenhum chamado encontrado
            </h3>
            <p className="small muted">
              {searchTerm || statusFilter !== "TODOS" || priorityFilter !== "TODOS"
                ? "Nenhum chamado corresponde aos filtros selecionados."
                : "A fila de atendimento de TI está limpa! Não há solicitações pendentes no momento."}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Solicitante & Depto</th>
                  <th>Categoria & Assunto</th>
                  <th>Prioridade</th>
                  <th>Status</th>
                  <th>Responsável</th>
                  <th>Abertura</th>
                  <th style={{ textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((t) => {
                  const dateStr = new Date(t.createdAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const phoneClean = t.requesterPhone?.replace(/\D/g, "");

                  return (
                    <tr key={t.id}>
                      <td>
                        <strong style={{ fontFamily: "monospace", fontSize: 13 }}>
                          {t.ticketNumber}
                        </strong>
                      </td>
                      <td>
                        <div>
                          <strong>{t.requesterName}</strong>
                          <div className="small muted">
                            {t.department || "Geral"}
                            {t.requesterPhone && (
                              <span style={{ marginLeft: 6 }}>
                                •{" "}
                                <a
                                  href={`https://wa.me/55${phoneClean}?text=Ol%C3%A1%20${encodeURIComponent(
                                    t.requesterName
                                  )}%2C%20sobre%20o%20chamado%20${t.ticketNumber}%3A`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: "#16a34a", fontWeight: 600 }}
                                  title="Iniciar conversa no WhatsApp"
                                >
                                  {t.requesterPhone}
                                </a>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ maxWidth: 260 }}>
                        <div className="small muted" style={{ fontSize: 11 }}>
                          {getCategoryLabel(t.category)}
                        </div>
                        <div
                          style={{
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={t.title}
                        >
                          {t.title}
                        </div>
                      </td>
                      <td>{getPriorityBadge(t.priority)}</td>
                      <td>{getStatusBadge(t.status)}</td>
                      <td>
                        <span className="small">
                          {t.assignedTo ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <User size={12} /> {t.assignedTo}
                            </span>
                          ) : (
                            <span className="muted">Não atribuído</span>
                          )}
                        </span>
                      </td>
                      <td className="small muted">{dateStr}</td>
                      <td style={{ textAlign: "right" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            gap: 6,
                            justifyContent: "flex-end",
                          }}
                        >
                          <button
                            type="button"
                            className="btn small secondary"
                            onClick={() => openDetailsModal(t)}
                            title="Ver detalhes do chamado"
                          >
                            Ver
                          </button>
                          <button
                            type="button"
                            className="btn small"
                            onClick={() => openActionModal(t)}
                            title="Atender ou resolver chamado"
                          >
                            Atender
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              className="btn small danger"
                              onClick={() => handleDelete(t.id)}
                              title="Excluir chamado"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Ação / Atendimento de TI */}
      {activeModal === "action" && selectedTicket && (
        <div className="bw-modal-overlay" onClick={() => setActiveModal(null)}>
          <div
            className="bw-modal-card"
            style={{ maxWidth: 540 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bw-modal-header">
              <div className="bw-modal-title">
                <Wrench size={18} />
                <div>
                  <h3>Atendimento do Chamado {selectedTicket.ticketNumber}</h3>
                  <span className="small muted">{selectedTicket.title}</span>
                </div>
              </div>
              <button
                type="button"
                className="bw-modal-close"
                onClick={() => setActiveModal(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAction}>
              <div className="bw-modal-body">
                <div
                  style={{
                    background: "var(--bg)",
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 16,
                    fontSize: 13,
                  }}
                >
                  <div style={{ marginBottom: 4 }}>
                    <strong>Solicitante:</strong> {selectedTicket.requesterName} (
                    {selectedTicket.department})
                  </div>
                  <div>
                    <strong>Descrição do Solicitante:</strong>
                    <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>
                      {selectedTicket.description}
                    </p>
                  </div>
                </div>

                <div className="bw-form-grid-2" style={{ marginBottom: 14 }}>
                  <div className="bw-field">
                    <label>Status do Chamado</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="bw-modal-input"
                    >
                      <option value="ABERTO">Novo / Aberto</option>
                      <option value="EM_ATENDIMENTO">Em Atendimento</option>
                      <option value="RESOLVIDO">Resolvido / Solucionado</option>
                      <option value="CANCELADO">Cancelado</option>
                    </select>
                  </div>

                  <div className="bw-field">
                    <label>Técnico Responsável</label>
                    <input
                      type="text"
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      placeholder="Nome do técnico de TI"
                      className="bw-modal-input"
                    />
                  </div>
                </div>

                <div className="bw-field">
                  <label>Parecer Técnico / Solução Aplicada</label>
                  <textarea
                    rows={4}
                    value={solutionNotes}
                    onChange={(e) => setSolutionNotes(e.target.value)}
                    placeholder="Descreva o procedimento realizado, orientações passadas ao colaborador ou motivo da resolução/cancelamento..."
                    className="bw-modal-input"
                    style={{ resize: "vertical" }}
                  />
                </div>
              </div>

              <div className="bw-modal-footer">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setActiveModal(null)}
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={isSaving}
                >
                  {isSaving ? "Salvando..." : "Atualizar Chamado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Detalhes Completos */}
      {activeModal === "details" && selectedTicket && (
        <div className="bw-modal-overlay" onClick={() => setActiveModal(null)}>
          <div
            className="bw-modal-card"
            style={{ maxWidth: 560 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bw-modal-header">
              <div className="bw-modal-title">
                <Ticket size={18} />
                <div>
                  <h3>Chamado {selectedTicket.ticketNumber}</h3>
                  <span className="small muted">Histórico de Atendimento</span>
                </div>
              </div>
              <button
                type="button"
                className="bw-modal-close"
                onClick={() => setActiveModal(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="bw-modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div>{getStatusBadge(selectedTicket.status)}</div>
                <div>{getPriorityBadge(selectedTicket.priority)}</div>
              </div>

              <div style={{ padding: "10px 14px", background: "var(--bg)", borderRadius: 8 }}>
                <h4 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 6px" }}>
                  {selectedTicket.title}
                </h4>
                <div className="small muted" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  <span>
                    <strong>Solicitante:</strong> {selectedTicket.requesterName}
                  </span>
                  <span>
                    <strong>Depto:</strong> {selectedTicket.department || "Geral"}
                  </span>
                  {selectedTicket.requesterEmail && (
                    <span>
                      <strong>E-mail:</strong> {selectedTicket.requesterEmail}
                    </span>
                  )}
                  {selectedTicket.requesterPhone && (
                    <span>
                      <strong>WhatsApp:</strong> {selectedTicket.requesterPhone}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <strong>Descrição da Solicitação:</strong>
                <p
                  style={{
                    margin: "6px 0 0",
                    padding: 12,
                    background: "var(--bg)",
                    borderRadius: 8,
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  {selectedTicket.description}
                </p>
              </div>

              {selectedTicket.solutionNotes && (
                <div>
                  <strong>Parecer Técnico / Solução da TI:</strong>
                  <p
                    style={{
                      margin: "6px 0 0",
                      padding: 12,
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      color: "#166534",
                      borderRadius: 8,
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    {selectedTicket.solutionNotes}
                  </p>
                </div>
              )}

              <div className="small muted" style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                <span>Aberto em: {new Date(selectedTicket.createdAt).toLocaleString("pt-BR")}</span>
                {selectedTicket.assignedTo && <span>Técnico: {selectedTicket.assignedTo}</span>}
              </div>
            </div>

            <div className="bw-modal-footer">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setActiveModal(null)}
              >
                Fechar
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setActiveModal("action");
                }}
              >
                Editar Atendimento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
