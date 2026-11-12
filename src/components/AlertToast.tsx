"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export type AlertType = "success" | "error" | "warning" | "info";

const ALERT_TITLES: Record<AlertType, string> = {
  success: "Sucesso",
  error: "Erro",
  warning: "Atenção",
  info: "Informação",
};

function getAlertStackRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  let root = document.getElementById("alert-floating-stack");
  if (!root) {
    root = document.createElement("div");
    root.id = "alert-floating-stack";
    root.className = "alert-floating-stack no-print";
    document.body.appendChild(root);
  }
  return root;
}

export function AlertToast({
  type,
  message,
  durationMs,
  triggerKey,
}: {
  type: AlertType;
  message: string;
  durationMs?: number;
  triggerKey?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [stackRoot, setStackRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    setStackRoot(getAlertStackRoot());
  }, []);

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const timeout = durationMs ?? (type === "error" ? 9000 : 6000);
    if (timeout <= 0) return;
    const timer = window.setTimeout(() => setVisible(false), timeout);
    return () => window.clearTimeout(timer);
  }, [message, type, durationMs, triggerKey]);

  if (!mounted || !stackRoot || !visible || !message) return null;

  const Icon =
    type === "error"
      ? AlertCircle
      : type === "warning"
        ? AlertTriangle
        : type === "info"
          ? Info
          : CheckCircle2;

  return createPortal(
    <div
      className={`alert alert-floating ${type}`}
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
    >
      <span className="alert-icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <div className="alert-content">
        <div className="alert-title">{ALERT_TITLES[type]}</div>
        <div className="alert-message">{message}</div>
      </div>
      <button
        type="button"
        className="alert-close"
        onClick={() => setVisible(false)}
        aria-label="Fechar alerta"
        title="Fechar alerta"
      >
        <X size={15} />
      </button>
    </div>,
    stackRoot,
  );
}
