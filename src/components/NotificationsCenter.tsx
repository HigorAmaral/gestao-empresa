"use client";

import { useState } from "react";
import { Bell, AlertTriangle, AlertCircle, Info, ChevronRight, X, Sparkles, Check } from "lucide-react";
import Link from "next/link";
import type { AppNotification } from "@/lib/notifications";

export function NotificationsCenter({ notifications }: { notifications: AppNotification[] }) {
  const [open, setOpen] = useState(false);
  const [runningAuto, setRunningAuto] = useState(false);
  const [autoMessage, setAutoMessage] = useState<string | null>(null);

  const criticalCount = notifications.filter((n) => n.level === "critico").length;
  const totalCount = notifications.length;

  async function handleRunAutomations() {
    setRunningAuto(true);
    setAutoMessage(null);
    try {
      const res = await fetch("/api/automations/run", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setAutoMessage("Automações executadas com sucesso!");
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setAutoMessage("Erro ao executar: " + (data.error || "Desconhecido"));
      }
    } catch {
      setAutoMessage("Falha de conexão.");
    } finally {
      setRunningAuto(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="notifications-bell-btn"
        onClick={() => setOpen(true)}
        title="Central de Alertas e Automações"
        aria-label="Notificações"
      >
        <Bell size={16} />
        {totalCount > 0 && (
          <span className={`notifications-badge-count ${criticalCount > 0 ? "critical" : ""}`}>
            {totalCount > 9 ? "9+" : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notifications-backdrop" onClick={() => setOpen(false)}>
          <div className="notifications-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="notifications-header">
              <div>
                <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Bell size={17} /> Notificações & Automações
                </h3>
                <div className="small muted">
                  {totalCount} alerta(s) ativo(s) em todos os módulos da empresa
                </div>
              </div>
              <button type="button" className="cmd-close" onClick={() => setOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--surface-subtle)" }}>
              <button
                type="button"
                className="btn sm"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={handleRunAutomations}
                disabled={runningAuto}
              >
                <Sparkles size={14} />
                {runningAuto ? "Executando Automações do Sistema..." : "Executar Automações Gerais do Sistema Agora"}
              </button>
              {autoMessage && (
                <div className="small" style={{ marginTop: 6, textAlign: "center", color: "var(--text)" }}>
                  <Check size={12} className="icon-inline" /> {autoMessage}
                </div>
              )}
            </div>

            <div className="notifications-list">
              {notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  className={`notification-card ${n.level}`}
                  onClick={() => setOpen(false)}
                >
                  <div className="notif-icon">
                    {n.level === "critico" && <AlertCircle size={18} />}
                    {n.level === "atencao" && <AlertTriangle size={18} />}
                    {n.level === "info" && <Info size={18} />}
                  </div>
                  <div className="notif-content">
                    <div className="notif-top">
                      <span className={`badge ${n.level === "critico" ? "red" : n.level === "atencao" ? "yellow" : "gray"}`}>
                        {n.level.toUpperCase()}
                      </span>
                      <strong style={{ fontSize: 13 }}>{n.title}</strong>
                    </div>
                    <div className="notif-detail">{n.detail}</div>
                  </div>
                  <ChevronRight size={16} className="notif-arrow" />
                </Link>
              ))}

              {notifications.length === 0 && (
                <div className="empty" style={{ padding: 40 }}>
                  Tudo em dia! Nenhuma pendência ou alerta no momento.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
