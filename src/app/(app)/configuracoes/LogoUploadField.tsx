"use client";

import { useRef, useState } from "react";
import { Building2, Image as ImageIcon, Link as LinkIcon, Trash2, Upload } from "lucide-react";

export function LogoUploadField({ initialLogoUrl }: { initialLogoUrl?: string | null }) {
  const [logoUrl, setLogoUrl] = useState<string>(initialLogoUrl || "");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Por favor, selecione um arquivo de imagem válido (PNG, JPG, SVG, WebP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      if (!src) return;

      // Se for SVG, salva direto
      if (file.type === "image/svg+xml") {
        setLogoUrl(src);
        return;
      }

      // Otimiza e redimensiona a imagem via Canvas para manter o banco leve e com alta resolução
      const img = new Image();
      img.onload = () => {
        const maxDim = 800;
        let w = img.width;
        let h = img.height;

        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL("image/png", 0.9);
          setLogoUrl(compressed);
        } else {
          setLogoUrl(src);
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  function handleRemove() {
    setLogoUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleApplyCustomUrl() {
    if (customUrl.trim()) {
      setLogoUrl(customUrl.trim());
      setCustomUrl("");
      setShowUrlInput(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Input oculto que envia a Logo no FormData do formulário */}
      <input type="hidden" name="logoUrl" value={logoUrl} />

      <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
        Logo Oficial da Empresa
      </label>
      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px" }}>
        Aparece no menu do site, tela de login e no cabeçalho de todos os documentos (Ordens de Produção, Recebimentos, Ordens de Serviço e Recibos de Venda).
      </p>

      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        {/* Caixa de Visualização da Logo */}
        <div
          style={{
            width: 115,
            height: 115,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "#ffffff",
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            flexShrink: 0,
            padding: 6,
          }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo da empresa"
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
            />
          ) : (
            <div style={{ textAlign: "center", color: "#a1a1aa" }}>
              <Building2 size={32} style={{ margin: "0 auto", opacity: 0.6 }} />
              <div style={{ fontSize: 10, marginTop: 2 }}>Sem logo</div>
            </div>
          )}
        </div>

        {/* Botões de Ação */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleFileChange}
              style={{ display: "none" }}
              id="company-logo-upload"
            />
            <button
              type="button"
              className="btn secondary"
              style={{ fontSize: 12.5, padding: "6px 12px" }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} /> {logoUrl ? "Trocar Logo do Computador" : "Enviar Imagem do Computador"}
            </button>

            <button
              type="button"
              className="btn ghost"
              style={{ fontSize: 12.5, padding: "6px 12px" }}
              onClick={() => setShowUrlInput((v) => !v)}
            >
              <LinkIcon size={14} /> {showUrlInput ? "Ocultar URL" : "Usar Link / URL"}
            </button>

            {logoUrl && (
              <button
                type="button"
                className="btn ghost text-danger"
                style={{ fontSize: 12.5, padding: "6px 10px" }}
                onClick={handleRemove}
                title="Remover logo e voltar ao ícone padrão"
              >
                <Trash2 size={14} /> Remover
              </button>
            )}
          </div>

          {/* Campo Opcional para Informar URL da Imagem */}
          {showUrlInput && (
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <input
                type="url"
                placeholder="https://exemplo.com.br/logo.png"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                style={{ width: 280, fontSize: 12.5, padding: "5px 8px" }}
              />
              <button
                type="button"
                className="btn secondary sm"
                onClick={handleApplyCustomUrl}
              >
                Aplicar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
