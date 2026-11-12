"use client";

import { useState, useEffect, useRef } from "react";
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  EyeOff,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import type { AppNotification } from "@/lib/notifications";
import type { AutomationResult } from "@/lib/automation";

export function NotificationsCenter({ notifications }: { notifications: AppNotification[] }) {
  const [open, setOpen] = useState(false);
  const [runningAuto, setRunningAuto] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<AutomationResult | null>(null);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const bellRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("app_dismissed_notifs_v1");
      if (stored) {
        setDismissedIds(JSON.parse(stored));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => closeBtnRef.current?.focus(), 20);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        bellRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function closeDrawer() {
    setOpen(false);
    setTimeout(() => bellRef.current?.focus(), 20);
  }

  function dismiss(id: string) {
    setDismissedIds((prev) => {
      const updated = Array.from(new Set([...prev, id]));
      try {
        localStorage.setItem("app_dismissed_notifs_v1", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }

  function restoreAll() {
    setDismissedIds([]);
    try {
      localStorage.removeItem("app_dismissed_notifs_v1");
    } catch {}
  }

  const visibleNotifications = notifications.filter((n) => !dismissedIds.includes(n.id));
  const criticalCount = visibleNotifications.filter((n) => n.level === "critico").length;
  const totalCount = visibleNotifications.length;
  const dismissedCount = notifications.length - visibleNotifications.length;

  async function handleRunAutomations() {
    setRunningAuto(true);
    setAutoError(null);
    try {
      const res = await fetch("/api/automations/run", { method: "POST" });
      const data = await res.json();
      if (data.ok && data.result) {
        setExecutionResult(data.result);
      } else {
        setAutoError(data.error || "Erro ao executar rotina de automação.");
      }
    } catch {
      setAutoError("Falha de conexão com o servidor ao executar automação.");
    } finally {
      setRunningAuto(false);
    }
  }

  return (
    <>
      <button
        ref={bellRef}
        type="button"
        className="notifications-bell-btn"
        onClick={() => setOpen(true)}
        title="Central de Alertas e Automações"
        aria-label={`Notificações (${totalCount} pendente${totalCount === 1 ? "" : "s"})`}
        aria-expanded={open}
      >
        <Bell size={16} aria-hidden="true" />
        {totalCount > 0 && (
          <span className={`notifications-badge-count ${criticalCount > 0 ? "critical" : ""}`}>
            {totalCount > 9 ? "9+" : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notifications-backdrop" role="presentation" onClick={closeDrawer}>
          <div
            className="notifications-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notifications-drawer-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="notifications-header">
              <div>
                <h3 id="notifications-drawer-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Bell size={17} aria-hidden="true" /> Notificações & Automações
                </h3>
                <div className="small muted">
                  {totalCount} alerta(s) pendente(s) · {notifications.length} monitorados
                </div>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                className="cmd-close"
                aria-label="Fechar central de notificações"
                onClick={closeDrawer}
              >
                <X size={16} aria-hidden="true" />
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
                {runningAuto ? "Executando Rotinas do Sistema..." : "Executar Automações Gerais do Sistema Agora"}
              </button>
              {autoError && (
                <div className="small" style={{ marginTop: 8, color: "#ef4444" }}>
                  <AlertTriangle size={12} className="icon-inline" /> {autoError}
                </div>
              )}
            </div>

            {/* Painel do Resultado Executivo da Automação */}
            {executionResult && (
              <div
                aria-live="polite"
                style={{ padding: "14px 16px", background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13 }}>
                    <CheckCircle2 size={16} /> Relatório da Automação Concluída
                  </div>
                  <button
                    type="button"
                    className="btn sm secondary"
                    style={{ fontSize: 11, padding: "2px 8px" }}
                    onClick={() => window.location.reload()}
                  >
                    <RefreshCw size={11} /> Atualizar Tela
                  </button>
                </div>
                <ul style={{ margin: "0 0 10px 0", paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>
                  {executionResult.summary?.map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
                <div className="small muted" style={{ padding: "8px 10px", background: "var(--surface-subtle)", borderRadius: 6, border: "1px solid var(--border)", lineHeight: 1.45 }}>
                  <strong style={{ display: "block", marginBottom: 3, color: "var(--text)" }}>
                    Por que algumas notificações continuam ativas?
                  </strong>
                  Alertas como <em>Contas a Pagar/Receber</em> ou <em>Férias</em> são obrigações financeiras e legais reais: o sistema gera os pedidos de compra e holerites, mas exige confirmação financeira real (baixa de pagamento) ou aprovação do RH. Você pode clicar em <strong>Dispensar</strong> em qualquer alerta caso já esteja ciente.
                </div>
              </div>
            )}

            <div className="notifications-list">
              {visibleNotifications.map((n) => (
                <div key={n.id} className={`notification-card ${n.level}`}>
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
                    <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <Link
                        href={n.href}
                        className="btn sm secondary"
                        style={{ fontSize: 11, padding: "3px 8px", textDecoration: "none" }}
                        onClick={() => setOpen(false)}
                      >
                        Resolver no Módulo <ExternalLink size={11} />
                      </Link>
                      <button
                        type="button"
                        className="btn sm secondary"
                        style={{ fontSize: 11, padding: "3px 8px" }}
                        onClick={() => dismiss(n.id)}
                        title="Ocultar este alerta se já estiver ciente"
                      >
                        <EyeOff size={11} /> Dispensar
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {visibleNotifications.length === 0 && (
                <div className="empty" style={{ padding: 40 }}>
                  <CheckCircle2 size={32} style={{ display: "block", margin: "0 auto 10px", opacity: 0.5 }} />
                  Tudo em dia! Nenhuma pendência ativa no momento.
                </div>
              )}
            </div>

            {dismissedCount > 0 && (
              <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", background: "var(--surface-subtle)", textAlign: "center" }}>
                <button
                  type="button"
                  className="btn sm secondary"
                  style={{ fontSize: 11, width: "100%", justifyContent: "center" }}
                  onClick={restoreAll}
                >
                  <RotateCcw size={12} /> Restaurar {dismissedCount} alerta(s) dispensado(s)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
