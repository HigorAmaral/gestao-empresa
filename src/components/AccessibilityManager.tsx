"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Accessibility, Check, RotateCcw, Volume2, X } from "lucide-react";

export type AccessibilityPrefs = {
  largeText: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
  soundFeedback: boolean;
};

const STORAGE_KEY = "a11y_prefs_v1";
const DEFAULT_PREFS: AccessibilityPrefs = {
  largeText: false,
  highContrast: false,
  reduceMotion: false,
  soundFeedback: false,
};

export function readAccessibilityPrefs(): AccessibilityPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function applyAccessibilityPrefs(prefs: AccessibilityPrefs) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (prefs.largeText) root.setAttribute("data-font", "large");
  else root.removeAttribute("data-font");

  if (prefs.highContrast) root.setAttribute("data-contrast", "high");
  else root.removeAttribute("data-contrast");

  if (prefs.reduceMotion) root.setAttribute("data-motion", "reduce");
  else root.removeAttribute("data-motion");
}

export function saveAccessibilityPrefs(prefs: AccessibilityPrefs) {
  applyAccessibilityPrefs(prefs);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {}
    window.dispatchEvent(new CustomEvent("a11y-prefs-changed", { detail: prefs }));
  }
}

/**
 * Feedback sonoro opcional via Web Audio API (útil no PDV e conferência de código de barras).
 */
export function playAccessibleBeep(kind: "ok" | "error") {
  if (typeof window === "undefined") return;
  const prefs = readAccessibilityPrefs();
  if (!prefs.soundFeedback) return;

  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = kind === "ok" ? "sine" : "square";
    osc.frequency.setValueAtTime(kind === "ok" ? 880 : 260, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (kind === "ok" ? 0.12 : 0.22));

    osc.start();
    osc.stop(ctx.currentTime + (kind === "ok" ? 0.13 : 0.23));
    setTimeout(() => ctx.close().catch(() => {}), 300);
  } catch {}
}

export function AccessibilityInitializer() {
  useEffect(() => {
    applyAccessibilityPrefs(readAccessibilityPrefs());
  }, []);
  return null;
}

export function AccessibilityControlsList() {
  const [prefs, setPrefs] = useState<AccessibilityPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(readAccessibilityPrefs());
    const handler = (e: Event) => {
      const custom = e as CustomEvent<AccessibilityPrefs>;
      if (custom.detail) setPrefs(custom.detail);
      else setPrefs(readAccessibilityPrefs());
    };
    window.addEventListener("a11y-prefs-changed", handler);
    return () => window.removeEventListener("a11y-prefs-changed", handler);
  }, []);

  function toggle(key: keyof AccessibilityPrefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    saveAccessibilityPrefs(next);
    if (key === "soundFeedback" && next.soundFeedback) {
      playAccessibleBeep("ok");
    }
  }

  function reset() {
    setPrefs(DEFAULT_PREFS);
    saveAccessibilityPrefs(DEFAULT_PREFS);
  }

  const options: { key: keyof AccessibilityPrefs; label: string; desc: string }[] = [
    {
      key: "largeText",
      label: "Texto ampliado (+15%)",
      desc: "Aumenta o tamanho base das fontes, botões e tabelas para leitura confortável.",
    },
    {
      key: "highContrast",
      label: "Alto contraste (WCAG AAA)",
      desc: "Reforça bordas, textos secundários e indicadores de foco na tela.",
    },
    {
      key: "reduceMotion",
      label: "Reduzir animações e transições",
      desc: "Desativa animações de abertura e movimento para maior conforto visual.",
    },
    {
      key: "soundFeedback",
      label: "Feedback sonoro no PDV e leitura de código",
      desc: "Emite um aviso sonoro discreto ao adicionar item ou detectar erro no caixa.",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {options.map((opt) => (
        <label
          key={opt.key}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: 10,
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: prefs[opt.key] ? "var(--surface-subtle)" : "var(--surface)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={prefs[opt.key]}
            onChange={() => toggle(opt.key)}
            style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0 }}
          />
          <div>
            <div className="bold" style={{ fontSize: 13.5 }}>
              {opt.label}
            </div>
            <div className="small muted">{opt.desc}</div>
          </div>
        </label>
      ))}

      <div className="row between" style={{ marginTop: 4 }}>
        <button
          type="button"
          className="btn sm secondary"
          onClick={() => playAccessibleBeep("ok")}
          disabled={!prefs.soundFeedback}
        >
          <Volume2 size={13} /> Testar Som
        </button>
        <button type="button" className="btn sm secondary" onClick={reset}>
          <RotateCcw size={13} /> Restaurar Padrão
        </button>
      </div>
    </div>
  );
}

export function AccessibilityQuickButton() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [hasActive, setHasActive] = useState(false);

  useEffect(() => {
    setMounted(true);
    const sync = () => {
      const p = readAccessibilityPrefs();
      setHasActive(p.largeText || p.highContrast || p.reduceMotion || p.soundFeedback);
    };
    sync();
    window.addEventListener("a11y-prefs-changed", sync);
    return () => window.removeEventListener("a11y-prefs-changed", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={`theme-btn ${hasActive ? "a11y-active" : ""}`}
        onClick={() => setOpen(true)}
        title="Acessibilidade (Fonte, Alto Contraste, Som)"
        aria-label="Abrir opções de acessibilidade"
        aria-expanded={open}
      >
        <Accessibility size={14} aria-hidden="true" />
      </button>

      {open &&
        mounted &&
        createPortal(
          <div className="a11y-backdrop no-print" role="presentation" onClick={() => setOpen(false)}>
            <div
              className="card a11y-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="a11y-dialog-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="row between mb">
                <h3 id="a11y-dialog-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Accessibility size={18} /> Acessibilidade & Preferências
                </h3>
                <button
                  type="button"
                  className="cmd-close"
                  aria-label="Fechar opções de acessibilidade"
                  onClick={() => setOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>
              <p className="small muted mb">
                Ajuste leitura, contraste, movimento e som. Suas preferências ficam salvas neste navegador.
              </p>
              <AccessibilityControlsList />
              <div className="row end" style={{ marginTop: 14 }}>
                <button type="button" className="btn sm" onClick={() => setOpen(false)}>
                  <Check size={14} /> Concluir
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
