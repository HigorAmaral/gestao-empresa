"use client";

import { useState } from "react";
import { Check, Copy, QrCode } from "lucide-react";
import { brl } from "@/lib/format";
import { generatePixPayload } from "@/lib/pix";

export function PixQrBox({
  pixKey,
  merchantName,
  merchantCity,
  amount,
  txid,
}: {
  pixKey: string;
  merchantName: string;
  merchantCity?: string | null;
  amount: number;
  txid: string;
}) {
  const [copied, setCopied] = useState(false);

  if (!pixKey || amount <= 0) return null;

  const payload = generatePixPayload({
    pixKey,
    merchantName,
    merchantCity,
    amount,
    txid,
  });

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=6&data=${encodeURIComponent(payload)}`;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback silencioso
    }
  }

  return (
    <div className="pix-receipt-box">
      <div className="pix-qr-frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrUrl} alt="QR Code PIX" width={132} height={132} />
      </div>
      <div className="pix-info">
        <div className="row" style={{ gap: 6 }}>
          <QrCode size={15} />
          <strong>PAGAMENTO INSTANTÂNEO VIA PIX</strong>
        </div>
        <div className="small" style={{ marginTop: 4 }}>
          Aponte a câmera do aplicativo do seu banco para o QR Code ao lado para pagar{" "}
          <strong>{brl(amount)}</strong>.
        </div>
        <div className="small muted" style={{ marginTop: 4 }}>
          <strong>Chave PIX:</strong> {pixKey} • <strong>Identificador:</strong> {txid}
        </div>
        <div className="no-print" style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" className="btn sm secondary" onClick={copyCode}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Código PIX copiado!" : "Copiar PIX Copia e Cola"}
          </button>
        </div>
      </div>
    </div>
  );
}
