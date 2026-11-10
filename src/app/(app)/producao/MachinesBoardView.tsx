"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Cpu,
  Factory,
  Layers,
  MapPin,
  Play,
  Plus,
  Printer,
  Sparkles,
  Trash2,
  User,
  Wrench,
  X,
} from "lucide-react";
import { fmtDate, fmtDateTime, num } from "@/lib/format";
import { ConfirmButton } from "@/components/Forms";
import { deleteProductionMachine } from "./actions";

export type MachineWithOrders = {
  id: number;
  name: string;
  code?: string | null;
  category?: string | null;
  location?: string | null;
  active: boolean;
  activeOrder?: {
    id: number;
    code: string;
    quantity: number;
    operatorName?: string | null;
    status: string;
    priority: string;
    startDate?: string | Date | null;
    deliveryDate?: string | Date | null;
    itemsCount: number;
    product: {
      id: number;
      name: string;
      sku?: string | null;
      unit: string;
    };
  } | null;
  queuedOrders?: {
    id: number;
    code: string;
    quantity: number;
    product: {
      name: string;
      unit: string;
    };
  }[];
};

export function MachinesBoardView({
  machines,
}: {
  machines: MachineWithOrders[];
}) {
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);

  const categories = Array.from(
    new Set(machines.map((m) => m.category).filter((c): c is string => Boolean(c)))
  );

  const filteredMachines = machines.filter((m) => {
    if (filterCategory && m.category !== filterCategory) return false;
    if (filterStatus) {
      if (filterStatus === "OPERANDO" && m.activeOrder?.status !== "EM_PRODUCAO") return false;
      if (filterStatus === "AGUARDANDO" && m.activeOrder?.status !== "PLANEJADA") return false;
      if (filterStatus === "DISPONIVEL" && m.activeOrder) return false;
    }
    return true;
  });

  const operatingCount = machines.filter((m) => m.activeOrder?.status === "EM_PRODUCAO").length;
  const waitingCount = machines.filter((m) => m.activeOrder?.status === "PLANEJADA").length;
  const idleCount = machines.filter((m) => !m.activeOrder).length;

  return (
    <div>
      {/* Resumo do Chão de Fábrica */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            borderRadius: 10,
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#065f46", textTransform: "uppercase" }}>
              Em Operação
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#047857", marginTop: 2 }}>{operatingCount}</div>
            <div style={{ fontSize: 11.5, color: "#047857" }}>Máquinas rodando agora</div>
          </div>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 10px #10b981" }} />
        </div>

        <div
          style={{
            background: "#fefce8",
            border: "1px solid #fde047",
            borderRadius: 10,
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#854d0e", textTransform: "uppercase" }}>
              Aguardando Insumos
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#a16207", marginTop: 2 }}>{waitingCount}</div>
            <div style={{ fontSize: 11.5, color: "#a16207" }}>OP planejada no posto</div>
          </div>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#eab308" }} />
        </div>

        <div
          style={{
            background: "#f4f4f5",
            border: "1px solid #e4e4e7",
            borderRadius: 10,
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#52525b", textTransform: "uppercase" }}>
              Disponíveis / Livres
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#27272a", marginTop: 2 }}>{idleCount}</div>
            <div style={{ fontSize: 11.5, color: "#71717a" }}>Prontas para novas OPs</div>
          </div>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#a1a1aa" }} />
        </div>
      </div>

      {/* Barra de Filtros e Cadastro de Nova Máquina */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {categories.length > 0 && (
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{ padding: "6px 12px", fontSize: 13 }}
            >
              <option value="">Todos os Setores / Categorias</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: "6px 12px", fontSize: 13 }}
          >
            <option value="">Todos os Estados</option>
            <option value="OPERANDO">🟢 Em Operação</option>
            <option value="AGUARDANDO">🟡 Aguardando Insumos</option>
            <option value="DISPONIVEL">⚪ Disponível</option>
          </select>
        </div>

        <button
          type="button"
          className="btn"
          onClick={() => setModalOpen(true)}
          style={{ fontSize: 13 }}
        >
          <Plus size={15} /> Cadastrar Nova Máquina / Posto
        </button>
      </div>

      {/* Grade de Postos e Máquinas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        {filteredMachines.map((machine) => {
          const activeOrder = machine.activeOrder;
          const isOperating = activeOrder?.status === "EM_PRODUCAO";
          const isWaiting = activeOrder?.status === "PLANEJADA";

          let borderStatusColor = "var(--border, #e4e4e7)";
          let statusBadge = (
            <span
              style={{
                background: "#f4f4f5",
                color: "#52525b",
                border: "1px solid #d4d4d8",
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#a1a1aa" }} />
              DISPONÍVEL
            </span>
          );

          if (isOperating) {
            borderStatusColor = "#22c55e";
            statusBadge = (
              <span
                style={{
                  background: "#dcfce7",
                  color: "#15803d",
                  border: "1px solid #86efac",
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#22c55e",
                    boxShadow: "0 0 6px #22c55e",
                  }}
                />
                EM OPERAÇÃO
              </span>
            );
          } else if (isWaiting) {
            borderStatusColor = "#eab308";
            statusBadge = (
              <span
                style={{
                  background: "#fef9c3",
                  color: "#854d0e",
                  border: "1px solid #fde047",
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#eab308" }} />
                AGUARDANDO INSUMOS
              </span>
            );
          }

          return (
            <div
              key={machine.id}
              className="card"
              style={{
                borderLeft: `4px solid ${borderStatusColor}`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: 16,
                position: "relative",
              }}
            >
              {/* Cabeçalho da Máquina */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                      <Factory size={16} />
                      {machine.name}
                    </h3>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                      {machine.code ? `[${machine.code}] • ` : ""}
                      {machine.category || "Geral"}
                      {machine.location ? ` • ${machine.location}` : ""}
                    </div>
                  </div>
                  <div>{statusBadge}</div>
                </div>

                {/* Corpo do Card: Informações da OP Ativa */}
                <div style={{ marginTop: 14 }}>
                  {activeOrder ? (
                    <div
                      style={{
                        background: "var(--bg-subtle, #f9fafb)",
                        border: "1px solid var(--border, #e5e7eb)",
                        borderRadius: 8,
                        padding: "10px 12px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <Link
                          href={`/producao/${activeOrder.id}`}
                          style={{ fontWeight: 700, fontSize: 13, fontFamily: "monospace", color: "inherit" }}
                        >
                          {activeOrder.code}
                        </Link>
                        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                          {activeOrder.itemsCount} insumo(s)
                        </span>
                      </div>

                      <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 4 }}>
                        {activeOrder.product.name}
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12 }}>
                        <div>
                          <span style={{ color: "var(--muted)" }}>Qtd: </span>
                          <strong>
                            {num(activeOrder.quantity)} {activeOrder.product.unit}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: "var(--muted)" }}>Operador: </span>
                          <strong>{activeOrder.operatorName || "Geral"}</strong>
                        </div>
                      </div>

                      {activeOrder.startDate && (
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                          <Clock size={11} /> Iniciada em {fmtDateTime(activeOrder.startDate)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        border: "1px dashed var(--border)",
                        borderRadius: 8,
                        padding: "20px 12px",
                        textAlign: "center",
                        color: "var(--muted)",
                        fontSize: 12.5,
                      }}
                    >
                      Máquina livre. Nenhum lote em produção neste posto.
                    </div>
                  )}

                  {/* Fila de Espera se houver ordens adicionais para esta máquina */}
                  {machine.queuedOrders && machine.queuedOrders.length > 0 && (
                    <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--muted)" }}>
                      <strong>Na fila: </strong>
                      {machine.queuedOrders.map((q) => `${q.code} (${num(q.quantity)} un)`).join(", ")}
                    </div>
                  )}
                </div>
              </div>

              {/* Rodapé com Ações Rápidas */}
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  marginTop: 14,
                  paddingTop: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                {activeOrder ? (
                  <div style={{ display: "flex", gap: 6, width: "100%", justifyContent: "flex-end" }}>
                    <Link
                      href={`/producao/${activeOrder.id}/recibo`}
                      className="btn secondary"
                      style={{ padding: "4px 8px", fontSize: 12 }}
                      title="Imprimir Ficha da Máquina"
                    >
                      <Printer size={13} /> Ficha
                    </Link>
                    <Link
                      href={`/producao/${activeOrder.id}`}
                      className="btn secondary"
                      style={{ padding: "4px 8px", fontSize: 12 }}
                    >
                      Ver OP →
                    </Link>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                    <ConfirmButton
                      action={deleteProductionMachine.bind(null, machine.id)}
                      confirmText={`Deseja remover a máquina "${machine.name}"?`}
                      className="btn ghost text-danger"
                      style={{ padding: "4px 6px", fontSize: 11 }}
                      title="Remover máquina"
                    >
                      <Trash2 size={13} />
                    </ConfirmButton>

                    <Link
                      href={`/producao/novo?machine=${encodeURIComponent(machine.name)}`}
                      className="btn"
                      style={{ padding: "5px 10px", fontSize: 12 }}
                    >
                      <Plus size={13} /> Criar OP nesta Máquina
                    </Link>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal para Cadastro de Máquina */}
      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{
              background: "var(--card-bg, #ffffff)",
              border: "1px solid var(--border, #e4e4e7)",
              borderRadius: 12,
              width: "100%",
              maxWidth: 450,
              padding: 22,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <Factory size={18} /> Cadastrar Nova Máquina / Posto
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="btn ghost" style={{ padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <form
              action="/api/machine" // fallback
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);
                const { createProductionMachine } = await import("./actions");
                await createProductionMachine(undefined, fd);
                setModalOpen(false);
                window.location.reload();
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
                    Nome da Máquina / Posto *
                  </label>
                  <input
                    type="text"
                    name="name"
                    placeholder="Ex: Torno CNC 03, Guilhotina 01"
                    required
                    style={{ width: "100%", padding: "8px 10px" }}
                    autoFocus
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
                    Código / Tag Identificadora
                  </label>
                  <input
                    type="text"
                    name="code"
                    placeholder="Ex: M-07, CNC-03"
                    style={{ width: "100%", padding: "8px 10px" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
                    Setor / Categoria
                  </label>
                  <input
                    type="text"
                    name="category"
                    placeholder="Ex: Usinagem, Injeção, Montagem, Solda"
                    list="category-suggestions"
                    style={{ width: "100%", padding: "8px 10px" }}
                  />
                  <datalist id="category-suggestions">
                    <option value="Usinagem" />
                    <option value="Fresamento" />
                    <option value="Injeção Plástica" />
                    <option value="Montagem" />
                    <option value="Soldagem" />
                    <option value="Corte e Dobra" />
                    <option value="Pintura e Acabamento" />
                  </datalist>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
                    Localização Física na Fábrica
                  </label>
                  <input
                    type="text"
                    name="location"
                    placeholder="Ex: Galpão 1 - Setor A, Linha 2"
                    style={{ width: "100%", padding: "8px 10px" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn ghost">
                  Cancelar
                </button>
                <button type="submit" className="btn">
                  Salvar Máquina
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
