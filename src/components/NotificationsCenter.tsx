"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [runningAuto, setRunningAuto] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<AutomationResult | null>(null);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const bellRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
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
        <Bell size={15} aria-hidden="true" />
        {totalCount > 0 && (
          <span className={`notifications-badge-count ${criticalCount > 0 ? "critical" : ""}`}>
            {totalCount > 9 ? "9+" : totalCount}
          </span>
        )}
      </button>

      {open &&
        mounted &&
        createPortal(
          <div className="notifications-backdrop no-print" role="presentation" onClick={closeDrawer}>
            <aside
              className="notifications-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="notifications-drawer-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="notifications-header">
                <div className="notifications-header-info">
                  <h3 id="notifications-drawer-title" className="notifications-header-title">
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

              <div className="notifications-toolbar">
                <button
                  type="button"
                  className="btn sm notifications-run-btn"
                  onClick={handleRunAutomations}
                  disabled={runningAuto}
                >
                  <Sparkles size={14} aria-hidden="true" />
                  {runningAuto ? "Executando Rotinas do Sistema..." : "Executar Automações Gerais Agora"}
                </button>
                {autoError && (
                  <div className="notifications-error" role="alert">
                    <AlertTriangle size={13} aria-hidden="true" />
                    <span>{autoError}</span>
                  </div>
                )}
              </div>

              {executionResult && (
                <div className="notifications-result" aria-live="polite">
                  <div className="notifications-result-header">
                    <div className="notifications-result-title">
                      <CheckCircle2 size={16} aria-hidden="true" /> Relatório da Automação Concluída
                    </div>
                    <button
                      type="button"
                      className="btn sm secondary notifications-mini-btn"
                      onClick={() => window.location.reload()}
                    >
                      <RefreshCw size={11} aria-hidden="true" /> Atualizar Tela
                    </button>
                  </div>
                  <ul className="notifications-result-list">
                    {executionResult.summary?.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                  <div className="notifications-note small muted">
                    <strong>Por que algumas notificações continuam ativas?</strong>
                    Alertas como <em>Contas a Pagar/Receber</em> ou <em>Férias</em> exigem confirmação financeira real ou aprovação do RH. Você pode clicar em <strong>Dispensar</strong> caso já esteja ciente.
                  </div>
                </div>
              )}

              <div className="notifications-list">
                {visibleNotifications.map((n) => (
                  <div key={n.id} className={`notification-card ${n.level}`}>
                    <div className="notif-icon" aria-hidden="true">
                      {n.level === "critico" && <AlertCircle size={18} />}
                      {n.level === "atencao" && <AlertTriangle size={18} />}
                      {n.level === "info" && <Info size={18} />}
                    </div>
                    <div className="notif-content">
                      <div className="notif-top">
                        <span className={`badge ${n.level === "critico" ? "red" : n.level === "atencao" ? "yellow" : "gray"}`}>
                          {n.level.toUpperCase()}
                        </span>
                        <strong className="notif-title">{n.title}</strong>
                      </div>
                      <div className="notif-detail">{n.detail}</div>
                      <div className="notif-actions">
                        <Link
                          href={n.href}
                          className="btn sm secondary notifications-mini-btn"
                          onClick={closeDrawer}
                        >
                          Resolver no Módulo <ExternalLink size={11} aria-hidden="true" />
                        </Link>
                        <button
                          type="button"
                          className="btn sm secondary notifications-mini-btn"
                          onClick={() => dismiss(n.id)}
                          title="Ocultar este alerta se já estiver ciente"
                        >
                          <EyeOff size={11} aria-hidden="true" /> Dispensar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {visibleNotifications.length === 0 && (
                  <div className="notifications-empty">
                    <CheckCircle2 size={32} aria-hidden="true" />
                    <p>Tudo em dia! Nenhuma pendência ativa no momento.</p>
                  </div>
                )}
              </div>

              {dismissedCount > 0 && (
                <div className="notifications-footer">
                  <button
                    type="button"
                    className="btn sm secondary notifications-run-btn"
                    onClick={restoreAll}
                  >
                    <RotateCcw size={12} aria-hidden="true" /> Restaurar {dismissedCount} alerta(s) dispensado(s)
                  </button>
                </div>
              )}
            </aside>
          </div>,
          document.body,
        )}
    </>
  );
}
