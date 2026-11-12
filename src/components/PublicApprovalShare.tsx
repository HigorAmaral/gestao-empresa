"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Share2 } from "lucide-react";

export function PublicApprovalShare({
  relativePath,
  clientPhone,
  whatsappMessagePrefix,
  label = "Link de Aprovação Online",
}: {
  relativePath: string;
  clientPhone?: string | null;
  whatsappMessagePrefix: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  function getFullUrl() {
    if (typeof window === "undefined") return relativePath;
    return `${window.location.origin}${relativePath}`;
  }

  function handleCopy() {
    const url = getFullUrl();
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  function handleWhatsApp() {
    const url = getFullUrl();
    const msg = `${whatsappMessagePrefix}\n\nAcesse e aprove online pelo link:\n${url}`;
    const digits = (clientPhone ?? "").replace(/\D/g, "");
    const phoneParam = digits.length >= 10 ? (digits.startsWith("55") ? digits : `55${digits}`) : "";
    const waUrl = phoneParam
      ? `https://wa.me/${phoneParam}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
      <button type="button" className="btn sm secondary" onClick={handleCopy} title="Copiar Link Público de Aprovação">
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Link Copiado!" : label}
      </button>
      <button
        type="button"
        className="btn sm secondary"
        onClick={handleWhatsApp}
        title="Enviar Link de Aprovação no WhatsApp do Cliente"
      >
        <Share2 size={14} /> Enviar Aprovação WhatsApp
      </button>
      <a className="btn sm ghost" href={relativePath} target="_blank" rel="noreferrer" title="Abrir página pública">
        <ExternalLink size={14} />
      </a>
    </div>
  );
}
