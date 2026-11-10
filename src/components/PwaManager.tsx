"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Download, Smartphone, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredPromptGlobal: BeforeInstallPromptEvent | null = null;

export function PwaServiceWorker() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("Falha ao registrar Service Worker PWA:", err);
      });
    }
  }, []);
  return null;
}

export function PwaInstallButton() {
  const [mounted, setMounted] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(deferredPromptGlobal);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      if (isStandalone) setInstalled(true);
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      deferredPromptGlobal = promptEvent;
      setDeferredPrompt(promptEvent);
    }

    function onInstalled() {
      deferredPromptGlobal = null;
      setDeferredPrompt(null);
      setInstalled(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        deferredPromptGlobal = null;
        setDeferredPrompt(null);
      }
      return;
    }
    setShowHelp(true);
  }

  if (installed) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontSize: 11,
          color: "#a1a1aa",
          marginTop: 8,
        }}
      >
        <CheckCircle2 size={12} /> App PWA instalado
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        style={{
          marginTop: 8,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          background: "#ffffff",
          color: "#09090b",
          border: "1px solid #ffffff",
          padding: "7px 10px",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
        }}
        title="Instalar sistema como aplicativo no computador ou celular"
      >
        <Download size={13} /> Instalar Aplicativo (PWA)
      </button>

      {showHelp &&
        mounted &&
        createPortal(
          <div className="cmd-backdrop" onClick={() => setShowHelp(false)}>
            <div className="cmd-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
              <div className="cmd-input-row" style={{ justifyContent: "space-between" }}>
                <div className="row" style={{ gap: 8 }}>
                  <Smartphone size={18} />
                  <strong>Instalar como Aplicativo (PWA)</strong>
                </div>
                <button type="button" className="cmd-close" onClick={() => setShowHelp(false)}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ padding: "18px 20px", fontSize: 13.5, lineHeight: 1.6 }}>
                <p style={{ marginTop: 0 }}>
                  Você pode instalar o sistema diretamente na sua Área de Trabalho ou na tela inicial do celular:
                </p>
                <ul style={{ paddingLeft: 18, margin: "10px 0" }}>
                  <li>
                    <strong>No Computador (Chrome / Edge):</strong> clique no ícone de{" "}
                    <strong>Instalar aplicativo</strong> (computador com seta) no canto direito da barra de endereço do
                    navegador.
                  </li>
                  <li style={{ marginTop: 6 }}>
                    <strong>No Android (Chrome):</strong> abra o menu <strong>⋮</strong> do navegador e toque em{" "}
                    <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.
                  </li>
                  <li style={{ marginTop: 6 }}>
                    <strong>No iPhone / iPad (Safari):</strong> toque no botão <strong>Compartilhar</strong> e selecione{" "}
                    <strong>Adicionar à Tela de Início</strong>.
                  </li>
                </ul>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                  <button type="button" className="btn sm" onClick={() => setShowHelp(false)}>
                    Entendi
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
