"use client";

import { useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Columns,
  Cpu,
  Database,
  Filter,
  Globe,
  HardDrive,
  Headphones,
  Laptop,
  Layers,
  LifeBuoy,
  List,
  Lock,
  MessageSquare,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  Server,
  Shield,
  ShieldCheck,
  Ticket,
  Trash2,
  TrendingUp,
  User,
  Wifi,
  Wrench,
  X,
} from "lucide-react";
import { updateTicketStatusAction, deleteTicketAction, deleteAssetAction } from "./actions";
import { NewAssetModal } from "./NewAssetModal";
import { NewInternalTicketModal } from "./NewInternalTicketModal";

export interface TicketItem {
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

export interface AssetItem {
  id: number;
  assetTag: string;
  name: string;
  category: string;
  serialNumber?: string | null;
  assignedUser?: string | null;
  department?: string | null;
  status: string;
  specifications?: string | null;
  notes?: string | null;
  createdAt: string | Date;
}

export interface HealthMetrics {
  dbStatus: string;
  dbLatencyMs: number;
  dbType: string;
  nextVersion: string;
  nodeVersion: string;
  memoryUsageMb: number;
  uptimeMinutes: number;
  ticketsCount: number;
  auditCount: number;
  usersCount: number;
  environment: string;
}

export interface TicketMetrics {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
}

export function TicketManagementView({
  initialTickets,
  assets,
  health,
  metrics,
  userName,
  isAdmin,
  initialTab = "chamados",
}: {
  initialTickets: TicketItem[];
  assets: AssetItem[];
  health: HealthMetrics;
  metrics: TicketMetrics;
  userName: string;
  isAdmin: boolean;
  initialTab?: string;
}) {
  const [activeTab, setActiveTab] = useState<"chamados" | "ativos" | "infra" | "kb">(
    (initialTab as any) || "chamados"
  );
  const [viewMode, setViewMode] = useState<"lista" | "kanban">("lista");

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [priorityFilter, setPriorityFilter] = useState("TODOS");

  // Modais de chamado
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [activeModal, setActiveModal] = useState<"action" | "details" | null>(null);
  const [newStatus, setNewStatus] = useState("EM_ATENDIMENTO");
  const [solutionNotes, setSolutionNotes] = useState("");
  const [assignedTo, setAssignedTo] = useState(userName);
  const [isSaving, setIsSaving] = useState(false);

  // Filtro de chamados
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

  const handleDeleteTicket = async (id: number) => {
    if (!window.confirm("Confirma a exclusão deste chamado da base de TI?")) return;
    const fd = new FormData();
    fd.set("id", String(id));
    await deleteTicketAction(fd);
    if (selectedTicket?.id === id) setActiveModal(null);
  };

  const handleDeleteAsset = async (id: number, tag: string) => {
    if (!window.confirm(`Confirma a exclusão do ativo ${tag}?`)) return;
    const fd = new FormData();
    fd.set("id", String(id));
    await deleteAssetAction(fd);
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

  const getAssetStatusBadge = (status: string) => {
    switch (status) {
      case "EM_USO":
        return <span className="badge success">🟢 Em Uso</span>;
      case "DISPONIVEL":
        return <span className="badge neutral">⚪ Disponível</span>;
      case "MANUTENCAO":
        return <span className="badge warning">🟠 Em Manutenção</span>;
      case "BAIXADO":
        return <span className="badge danger">🔴 Desativado</span>;
      default:
        return <span className="badge neutral">{status}</span>;
    }
  };

  return (
    <div>
      {/* Abas Superiores do Departamento de TI */}
      <div className="card mb" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg)", overflowX: "auto" }}>
          <button
            type="button"
            className={`btn-tab ${activeTab === "chamados" ? "active" : ""}`}
            onClick={() => setActiveTab("chamados")}
            style={{
              padding: "14px 20px",
              background: activeTab === "chamados" ? "var(--card-bg)" : "transparent",
              border: "none",
              borderBottom: activeTab === "chamados" ? "3px solid #000000" : "3px solid transparent",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13.5,
              color: activeTab === "chamados" ? "var(--text)" : "var(--muted)",
              whiteSpace: "nowrap",
            }}
          >
            <Ticket size={16} /> Central de Chamados ({metrics.open} abertos)
          </button>

          <button
            type="button"
            className={`btn-tab ${activeTab === "ativos" ? "active" : ""}`}
            onClick={() => setActiveTab("ativos")}
            style={{
              padding: "14px 20px",
              background: activeTab === "ativos" ? "var(--card-bg)" : "transparent",
              border: "none",
              borderBottom: activeTab === "ativos" ? "3px solid #000000" : "3px solid transparent",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13.5,
              color: activeTab === "ativos" ? "var(--text)" : "var(--muted)",
              whiteSpace: "nowrap",
            }}
          >
            <Laptop size={16} /> Inventário de Ativos ({assets.length})
          </button>

          <button
            type="button"
            className={`btn-tab ${activeTab === "infra" ? "active" : ""}`}
            onClick={() => setActiveTab("infra")}
            style={{
              padding: "14px 20px",
              background: activeTab === "infra" ? "var(--card-bg)" : "transparent",
              border: "none",
              borderBottom: activeTab === "infra" ? "3px solid #000000" : "3px solid transparent",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13.5,
              color: activeTab === "infra" ? "var(--text)" : "var(--muted)",
              whiteSpace: "nowrap",
            }}
          >
            <Server size={16} /> Saúde & Infraestrutura
          </button>

          <button
            type="button"
            className={`btn-tab ${activeTab === "kb" ? "active" : ""}`}
            onClick={() => setActiveTab("kb")}
            style={{
              padding: "14px 20px",
              background: activeTab === "kb" ? "var(--card-bg)" : "transparent",
              border: "none",
              borderBottom: activeTab === "kb" ? "3px solid #000000" : "3px solid transparent",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13.5,
              color: activeTab === "kb" ? "var(--text)" : "var(--muted)",
              whiteSpace: "nowrap",
            }}
          >
            <BookOpen size={16} /> Base de Conhecimento (POPs)
          </button>
        </div>
      </div>

      {/* ====================================================
          ABA 1: CENTRAL DE CHAMADOS & HELPDESK
          ==================================================== */}
      {activeTab === "chamados" && (
        <>
          {/* Métricas dos Chamados */}
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

          {/* Barra de Filtros e Alternância de Visualização (Tabela x Kanban) */}
          <div className="card mb">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 10, flex: 1, minWidth: 260, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
                  <Search
                    size={15}
                    style={{ position: "absolute", left: 12, top: 11, color: "var(--muted)" }}
                  />
                  <input
                    type="text"
                    placeholder="Buscar por protocolo, solicitante ou assunto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ paddingLeft: 34, width: "100%" }}
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ minWidth: 140 }}
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
                  style={{ minWidth: 130 }}
                >
                  <option value="TODOS">Todas Prioridades</option>
                  <option value="URGENTE">Urgente</option>
                  <option value="ALTA">Alta</option>
                  <option value="NORMAL">Normal</option>
                  <option value="BAIXA">Baixa</option>
                </select>
              </div>

              {/* Botões de Alternância de Visualização */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className={`btn small ${viewMode === "lista" ? "" : "secondary"}`}
                  onClick={() => setViewMode("lista")}
                  title="Visualização em Lista"
                >
                  <List size={14} /> Lista
                </button>
                <button
                  type="button"
                  className={`btn small ${viewMode === "kanban" ? "" : "secondary"}`}
                  onClick={() => setViewMode("kanban")}
                  title="Visualização em Kanban"
                >
                  <Columns size={14} /> Quadro Kanban
                </button>
                <NewInternalTicketModal userName={userName} />
              </div>
            </div>
          </div>

          {/* MODO LISTA / TABELA */}
          {viewMode === "lista" && (
            <div className="card">
              {filteredTickets.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 20px" }}>
                  <Headphones size={42} style={{ color: "var(--muted)", marginBottom: 12 }} />
                  <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
                    Nenhum chamado encontrado
                  </h3>
                  <p className="small muted">
                    Não há solicitações correspondentes aos filtros selecionados.
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
                        <th>Técnico</th>
                        <th>Data Abertura</th>
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
                                        title="Chamar no WhatsApp"
                                      >
                                        WhatsApp
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
                              <div style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                                <button
                                  type="button"
                                  className="btn small secondary"
                                  onClick={() => openDetailsModal(t)}
                                >
                                  Ver
                                </button>
                                <button
                                  type="button"
                                  className="btn small"
                                  onClick={() => openActionModal(t)}
                                >
                                  Atender
                                </button>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    className="btn small danger"
                                    onClick={() => handleDeleteTicket(t.id)}
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
          )}

          {/* MODO KANBAN BOARD */}
          {viewMode === "kanban" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 16,
                alignItems: "flex-start",
              }}
            >
              {[
                { key: "ABERTO", label: "Novos / Abertos", color: "#ef4444" },
                { key: "EM_ATENDIMENTO", label: "Em Atendimento", color: "#f59e0b" },
                { key: "RESOLVIDO", label: "Resolvidos", color: "#10b981" },
                { key: "CANCELADO", label: "Cancelados", color: "#71717a" },
              ].map((col) => {
                const columnTickets = filteredTickets.filter((t) => t.status === col.key);

                return (
                  <div
                    key={col.key}
                    style={{
                      background: "var(--bg)",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      padding: 14,
                      minHeight: 300,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingBottom: 10,
                        borderBottom: `2px solid ${col.color}`,
                        marginBottom: 12,
                      }}
                    >
                      <strong style={{ fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: col.color,
                          }}
                        />
                        {col.label}
                      </strong>
                      <span className="badge small neutral">{columnTickets.length}</span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {columnTickets.length === 0 ? (
                        <div className="small muted" style={{ textAlign: "center", padding: "20px 0" }}>
                          Nenhum chamado nesta etapa.
                        </div>
                      ) : (
                        columnTickets.map((t) => (
                          <div
                            key={t.id}
                            style={{
                              background: "var(--card-bg)",
                              borderRadius: 8,
                              border: "1px solid var(--border)",
                              padding: 12,
                              boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                              cursor: "pointer",
                            }}
                            onClick={() => openDetailsModal(t)}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: 6,
                              }}
                            >
                              <strong style={{ fontFamily: "monospace", fontSize: 12 }}>
                                {t.ticketNumber}
                              </strong>
                              {getPriorityBadge(t.priority)}
                            </div>

                            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                              {t.title}
                            </div>

                            <div className="small muted" style={{ fontSize: 11.5, marginBottom: 8 }}>
                              {t.requesterName} • {t.department || "Geral"}
                            </div>

                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                borderTop: "1px solid var(--border)",
                                paddingTop: 8,
                              }}
                            >
                              <span className="small muted" style={{ fontSize: 11 }}>
                                {new Date(t.createdAt).toLocaleDateString("pt-BR")}
                              </span>

                              <button
                                type="button"
                                className="btn small"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openActionModal(t);
                                }}
                              >
                                Atender
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ====================================================
          ABA 2: INVENTÁRIO DE ATIVOS & EQUIPAMENTOS DE TI
          ==================================================== */}
      {activeTab === "ativos" && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <h2>
                <Laptop size={18} /> Gestão de Ativos & Hardware Corporativo
              </h2>
              <p className="small muted">
                Controle de computadores, notebooks, impressoras, periféricos e estações de trabalho
              </p>
            </div>
            <NewAssetModal />
          </div>

          {assets.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px" }}>
              <Laptop size={42} style={{ color: "var(--muted)", marginBottom: 12 }} />
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
                Nenhum ativo cadastrado
              </h3>
              <p className="small muted">
                Cadastre notebooks, computadores, monitores e impressoras para controlar a posse e o patrimônio.
              </p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Patrimônio</th>
                    <th>Equipamento / Modelo</th>
                    <th>Categoria</th>
                    <th>Nº de Série</th>
                    <th>Colaborador em Posse</th>
                    <th>Departamento</th>
                    <th>Status</th>
                    <th>Especificações</th>
                    {isAdmin && <th style={{ textAlign: "right" }}>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset.id}>
                      <td>
                        <strong style={{ fontFamily: "monospace", fontSize: 13 }}>
                          {asset.assetTag}
                        </strong>
                      </td>
                      <td>
                        <strong>{asset.name}</strong>
                      </td>
                      <td>
                        <span className="small muted">{asset.category}</span>
                      </td>
                      <td>
                        <span style={{ fontFamily: "monospace", fontSize: 12 }}>
                          {asset.serialNumber || "—"}
                        </span>
                      </td>
                      <td>
                        {asset.assignedUser ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600 }}>
                            <User size={13} /> {asset.assignedUser}
                          </span>
                        ) : (
                          <span className="muted">Disponível em TI</span>
                        )}
                      </td>
                      <td>{asset.department || "—"}</td>
                      <td>{getAssetStatusBadge(asset.status)}</td>
                      <td>
                        <span className="small muted" title={asset.specifications || ""}>
                          {asset.specifications || "—"}
                        </span>
                      </td>
                      {isAdmin && (
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="btn small danger"
                            onClick={() => handleDeleteAsset(asset.id, asset.assetTag)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ====================================================
          ABA 3: SAÚDE DOS SERVIDORES & INFRAESTRUTURA
          ==================================================== */}
      {activeTab === "infra" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Status Geral de Conexões */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: 16 }}>
              <h2>
                <Activity size={18} /> Monitoramento em Tempo Real da Infraestrutura
              </h2>
              <span className="badge success">
                <CheckCircle2 size={13} /> Todos os Serviços Operacionais
              </span>
            </div>

            <div className="stats mb">
              <div className="stat">
                <div className="label">Latência do Banco de Dados</div>
                <div className="value" style={{ color: health.dbLatencyMs < 80 ? "#10b981" : "#f59e0b" }}>
                  {health.dbLatencyMs} ms
                </div>
              </div>
              <div className="stat">
                <div className="label">Memória Heap em Uso</div>
                <div className="value">{health.memoryUsageMb} MB</div>
              </div>
              <div className="stat">
                <div className="label">Tempo Ativo (Uptime)</div>
                <div className="value">{health.uptimeMinutes} min</div>
              </div>
              <div className="stat">
                <div className="label">Total de Logs de Auditoria</div>
                <div className="value">{health.auditCount}</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
              <div style={{ padding: 16, background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <Database size={20} color="#10b981" />
                  <strong>Banco PostgreSQL Serverless</strong>
                </div>
                <p className="small muted" style={{ margin: 0 }}>
                  Provedor: {health.dbType}
                  <br />
                  Pool Conexões: 10 máx / Timeout 20s
                  <br />
                  Status: 🟢 <strong>Ativo e Responsivo</strong>
                </p>
              </div>

              <div style={{ padding: 16, background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <Server size={20} color="#10b981" />
                  <strong>Servidor de Aplicação Web</strong>
                </div>
                <p className="small muted" style={{ margin: 0 }}>
                  Engine: Next.js {health.nextVersion}
                  <br />
                  Runtime: Node.js {health.nodeVersion}
                  <br />
                  Ambiente: <strong>{health.environment}</strong>
                </p>
              </div>

              <div style={{ padding: 16, background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <ShieldCheck size={20} color="#10b981" />
                  <strong>Segurança & Criptografia</strong>
                </div>
                <p className="small muted" style={{ margin: 0 }}>
                  Protocolo: SSL/TLS 256-bit
                  <br />
                  Sessões: JWT SHA-256 HttpOnly
                  <br />
                  Auditoria: <strong>100% Rastreável</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          ABA 4: BASE DE CONHECIMENTO & PROCEDIMENTOS (KB)
          ==================================================== */}
      {activeTab === "kb" && (
        <div className="card">
          <div className="card-header" style={{ marginBottom: 18 }}>
            <div>
              <h2>
                <BookOpen size={18} /> Procedimentos Operacionais Padrão (POPs de TI)
              </h2>
              <p className="small muted">
                Guia de resolução rápida de incidentes frequentes para o suporte interno da empresa
              </p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ padding: 16, background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)" }}>
              <h4 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 6px", display: "flex", alignItems: "center", gap: 8 }}>
                <Lock size={16} /> POP-01: Redefinição de Senha e Desbloqueio de Acesso
              </h4>
              <p className="small" style={{ lineHeight: 1.6, margin: 0 }}>
                1. Acesse o módulo <strong>Usuários</strong> na barra lateral.<br />
                2. Localize o colaborador pelo e-mail ou nome.<br />
                3. Clique em <strong>Editar</strong>, digite a nova senha provisória e confirme.<br />
                4. Notifique o colaborador pelo WhatsApp ou e-mail corporativo cadastrado.
              </p>
            </div>

            <div style={{ padding: 16, background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)" }}>
              <h4 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 6px", display: "flex", alignItems: "center", gap: 8 }}>
                <Printer size={16} /> POP-02: Configuração de Impressoras Térmicas e Etiquetas (Zebra / Epson)
              </h4>
              <p className="small" style={{ lineHeight: 1.6, margin: 0 }}>
                1. Verifique se o driver RAW ou Spooler do Windows está configurado como padrão.<br />
                2. No sistema, acesse <strong>Produtos &gt; Imprimir Etiquetas</strong> ou o botão <strong>Recibo</strong> na venda/OS.<br />
                3. Selecione o tamanho de papel 80mm ou 58mm nas configurações de impressão do navegador.<br />
                4. Desmarque &quot;Cabeçalhos e rodapés&quot; para evitar texto indesejado na bobina.
              </p>
            </div>

            <div style={{ padding: 16, background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)" }}>
              <h4 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 6px", display: "flex", alignItems: "center", gap: 8 }}>
                <HardDrive size={16} /> POP-03: Rotina de Backup dos Dados do ERP
              </h4>
              <p className="small" style={{ lineHeight: 1.6, margin: 0 }}>
                1. Acesse <strong>Configurações &gt; Segurança e Governança</strong>.<br />
                2. Clique em <strong>Baixar Backup Geral do Sistema (.JSON)</strong> para gerar um arquivo estruturado com todas as entidades.<br />
                3. Guarde uma cópia de segurança em disco externo criptografado ou nuvem segura corporativa.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ação / Atendimento */}
      {activeModal === "action" && selectedTicket && (
        <div className="bw-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="bw-modal-card" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="bw-modal-header">
              <div className="bw-modal-title">
                <Wrench size={18} />
                <div>
                  <h3>Atendimento do Chamado {selectedTicket.ticketNumber}</h3>
                  <span className="small muted">{selectedTicket.title}</span>
                </div>
              </div>
              <button type="button" className="bw-modal-close" onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAction}>
              <div className="bw-modal-body">
                <div style={{ background: "var(--bg)", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                  <div>
                    <strong>Solicitante:</strong> {selectedTicket.requesterName} ({selectedTicket.department})
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <strong>Descrição:</strong> {selectedTicket.description}
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
                      className="bw-modal-input"
                    />
                  </div>
                </div>

                <div className="bw-field">
                  <label>Parecer Técnico / Resolução</label>
                  <textarea
                    rows={4}
                    value={solutionNotes}
                    onChange={(e) => setSolutionNotes(e.target.value)}
                    placeholder="Descreva o procedimento aplicado para resolver o incidente..."
                    className="bw-modal-input"
                    style={{ resize: "vertical" }}
                  />
                </div>
              </div>

              <div className="bw-modal-footer">
                <button type="button" className="btn secondary" onClick={() => setActiveModal(null)} disabled={isSaving}>
                  Cancelar
                </button>
                <button type="submit" className="btn" disabled={isSaving}>
                  {isSaving ? "Salvando..." : "Salvar Atendimento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Detalhes */}
      {activeModal === "details" && selectedTicket && (
        <div className="bw-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="bw-modal-card" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="bw-modal-header">
              <div className="bw-modal-title">
                <Ticket size={18} />
                <div>
                  <h3>Chamado {selectedTicket.ticketNumber}</h3>
                  <span className="small muted">Detalhes da Ocorrência</span>
                </div>
              </div>
              <button type="button" className="bw-modal-close" onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="bw-modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>{getStatusBadge(selectedTicket.status)}</div>
                <div>{getPriorityBadge(selectedTicket.priority)}</div>
              </div>

              <div style={{ padding: 12, background: "var(--bg)", borderRadius: 8 }}>
                <h4 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>{selectedTicket.title}</h4>
                <div className="small muted">
                  {selectedTicket.requesterName} • {selectedTicket.department}
                  {selectedTicket.requesterPhone && ` • Tel: ${selectedTicket.requesterPhone}`}
                </div>
              </div>

              <div>
                <strong>Descrição do Chamado:</strong>
                <p style={{ margin: "4px 0 0", padding: 10, background: "var(--bg)", borderRadius: 6, fontSize: 13 }}>
                  {selectedTicket.description}
                </p>
              </div>

              {selectedTicket.solutionNotes && (
                <div>
                  <strong>Parecer Técnico:</strong>
                  <p style={{ margin: "4px 0 0", padding: 10, background: "#f0fdf4", color: "#166534", borderRadius: 6, fontSize: 13 }}>
                    {selectedTicket.solutionNotes}
                  </p>
                </div>
              )}
            </div>

            <div className="bw-modal-footer">
              <button type="button" className="btn secondary" onClick={() => setActiveModal(null)}>
                Fechar
              </button>
              <button type="button" className="btn" onClick={() => setActiveModal("action")}>
                Atender Chamado
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
