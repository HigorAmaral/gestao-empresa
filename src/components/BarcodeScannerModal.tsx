"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Flashlight, RefreshCw, X, Zap } from "lucide-react";

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {}
}

export function BarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
  title = "Escanear Código de Barras ou QR Code",
  instruction = "Aponte a câmera para a etiqueta do produto, endereço ou ordem de produção.",
}: {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
  instruction?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    async function startCamera() {
      setErrorMsg(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Câmera não suportada neste navegador.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          startScanningLoop();
        }
      } catch (err: unknown) {
        setHasCamera(false);
        const msg = err instanceof Error ? err.message : "Erro ao abrir câmera.";
        setErrorMsg("Não foi possível acessar a câmera (" + msg + "). Use o campo manual abaixo.");
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen]);

  function handleDetected(code: string) {
    playBeep();
    if (navigator.vibrate) navigator.vibrate(80);
    onScan(code.trim());
    onClose();
  }

  function startScanningLoop() {
    // Verifica suporte ao BarcodeDetector nativo
    const BarcodeDetectorClass = (window as unknown as { BarcodeDetector?: new (options?: { formats: string[] }) => { detect: (source: ImageBitmapSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;

    if (!BarcodeDetectorClass) {
      return;
    }

    try {
      const detector = new BarcodeDetectorClass({
        formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "upc_a", "upc_e", "itf"],
      });

      const tick = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          animFrameRef.current = requestAnimationFrame(tick);
          return;
        }

        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            handleDetected(barcodes[0].rawValue);
            return;
          }
        } catch {}

        animFrameRef.current = requestAnimationFrame(tick);
      };

      animFrameRef.current = requestAnimationFrame(tick);
    } catch {}
  }

  async function toggleTorch() {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const next = !torchOn;
      // @ts-expect-error Torch constraints support in Chrome Android
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {}
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface, #18181b)",
          color: "var(--text, #ffffff)",
          border: "1px solid var(--border, #27272a)",
          borderRadius: 14,
          width: "100%",
          maxWidth: 440,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid var(--border, #27272a)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 15 }}>
            <Camera size={18} />
            <span>{title}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn ghost"
            style={{ padding: 4 }}
            title="Fechar leitor"
          >
            <X size={18} />
          </button>
        </div>

        {/* Área da Câmera / Visor */}
        <div style={{ position: "relative", width: "100%", height: 260, background: "#000000", overflow: "hidden" }}>
          {hasCamera ? (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              {/* Retículo de Alinhamento do Código */}
              <div
                style={{
                  position: "absolute",
                  inset: "25% 15%",
                  border: "2px solid #22c55e",
                  borderRadius: 10,
                  boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.45)",
                  pointerEvents: "none",
                }}
              >
                {/* Linha Laser Animada */}
                <div
                  style={{
                    width: "100%",
                    height: 2,
                    background: "#22c55e",
                    boxShadow: "0 0 8px #22c55e",
                    position: "absolute",
                    top: "50%",
                  }}
                />
              </div>

              {/* Botão de Lanterna (Torch) */}
              <button
                type="button"
                onClick={toggleTorch}
                style={{
                  position: "absolute",
                  bottom: 12,
                  right: 12,
                  background: torchOn ? "#22c55e" : "rgba(0,0,0,0.6)",
                  color: "#ffffff",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                }}
              >
                <Flashlight size={14} />
                <span>{torchOn ? "Lanterna Ligada" : "Lanterna"}</span>
              </button>
            </>
          ) : (
            <div style={{ display: "grid", placeItems: "center", height: "100%", padding: 20, textAlign: "center", color: "#a1a1aa" }}>
              <div>
                <Camera size={36} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
                <div style={{ fontSize: 13 }}>{errorMsg}</div>
              </div>
            </div>
          )}
        </div>

        {/* Instrução e Entrada Manual de Código */}
        <div style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: "var(--muted, #a1a1aa)", margin: "0 0 12px", textAlign: "center" }}>
            {instruction}
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manualCode.trim()) handleDetected(manualCode);
            }}
            style={{ display: "flex", gap: 8 }}
          >
            <input
              type="text"
              placeholder="Ou digite/bipe o código aqui..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              style={{ flex: 1, padding: "8px 12px", fontSize: 13 }}
              autoFocus
            />
            <button type="submit" className="btn" disabled={!manualCode.trim()}>
              Confirmar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
