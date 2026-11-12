"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Copy, Printer, QrCode, Tag } from "lucide-react";
import { fmtDate, fmtDateTime, num } from "@/lib/format";

type CompanyInfo = {
  name: string;
  tradeName?: string | null;
  document?: string | null;
  logoUrl?: string | null;
};

type OrderInfo = {
  id: number;
  code: string;
  quantity: number;
  machine: string;
  operatorName?: string | null;
  priority: string;
  status: string;
  createdAt: string | Date;
  completedAt?: string | Date | null;
  notes?: string | null;
  product: {
    id: number;
    sku?: string | null;
    name: string;
    unit: string;
  };
};

/**
 * Renderiza um código de barras estilizado Code128 / Code39 em SVG puro
 */
function SvgBarcode({ text }: { text: string }) {
  // Gera uma sequência determinística de barras baseada nos caracteres
  const bars: { width: number; isBlack: boolean }[] = [];
  bars.push({ width: 2, isBlack: true });
  bars.push({ width: 1, isBlack: false });
  bars.push({ width: 2, isBlack: true });

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const b1 = (code % 3) + 1;
    const b2 = ((code >> 1) % 2) + 1;
    const b3 = ((code >> 2) % 3) + 1;
    const b4 = ((code >> 3) % 2) + 1;

    bars.push({ width: b1, isBlack: true });
    bars.push({ width: b2, isBlack: false });
    bars.push({ width: b3, isBlack: true });
    bars.push({ width: b4, isBlack: false });
  }

  bars.push({ width: 3, isBlack: true });
  bars.push({ width: 1, isBlack: false });
  bars.push({ width: 2, isBlack: true });

  let currentX = 10;
  const rects = bars.map((b, idx) => {
    const x = currentX;
    currentX += b.width * 2.2;
    if (!b.isBlack) return null;
    return <rect key={idx} x={x} y={4} width={b.width * 2.2} height={42} fill="#000000" />;
  });

  const totalWidth = Math.max(currentX + 10, 200);

  return (
    <div style={{ textAlign: "center" }}>
      <svg
        viewBox={`0 0 ${totalWidth} 50`}
        style={{ width: "100%", maxHeight: 46, display: "block", margin: "0 auto" }}
      >
        {rects}
      </svg>
      <div style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, letterSpacing: 2, marginTop: 2 }}>
        *{text}*
      </div>
    </div>
  );
}

/**
 * Simulação de QR Code vetorial estilizado
 */
function SvgQrCode({ text }: { text: string }) {
  // Cria um padrão estilizado com os cantos marcadores de QR Code
  return (
    <div
      style={{
        width: 64,
        height: 64,
        border: "2px solid #000",
        padding: 3,
        display: "grid",
        gridTemplateColumns: "repeat(6, 1fr)",
        gridTemplateRows: "repeat(6, 1fr)",
        gap: 2,
        background: "#fff",
        flexShrink: 0,
      }}
      title={text}
    >
      {/* Canto Sup Esq */}
      <div style={{ gridArea: "1 / 1 / 3 / 3", background: "#000" }} />
      {/* Canto Sup Dir */}
      <div style={{ gridArea: "1 / 5 / 3 / 7", background: "#000" }} />
      {/* Canto Inf Esq */}
      <div style={{ gridArea: "5 / 1 / 7 / 3", background: "#000" }} />
      {/* Padrão interno determinístico */}
      <div style={{ gridArea: "2 / 3 / 4 / 5", background: "#000" }} />
      <div style={{ gridArea: "5 / 4 / 7 / 6", background: "#000" }} />
      <div style={{ gridArea: "4 / 2 / 5 / 3", background: "#000" }} />
      <div style={{ gridArea: "4 / 5 / 5 / 6", background: "#000" }} />
    </div>
  );
}

export function EtiquetasView({
  order,
  company,
}: {
  order: OrderInfo;
  company: CompanyInfo;
}) {
  const [copies, setCopies] = useState<number>(4);
  const [format, setFormat] = useState<"sheet" | "thermal">("sheet");

  const lotNumber = `LOT-${order.code.replace("OP-", "")}`;

  return (
    <>
      {/* Painel de Controle de Impressão (Oculto na impressão física) */}
      <div
        className="no-print"
        style={{
          background: "var(--card-bg, #ffffff)",
          border: "1px solid var(--border, #e4e4e7)",
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={`/producao/${order.id}`} className="btn secondary" style={{ fontSize: 13 }}>
            <ArrowLeft size={16} /> Voltar à OP
          </Link>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
              Etiquetas de Identificação do Lote — {order.code}
            </h2>
            <div style={{ fontSize: 12.5, color: "var(--muted, #71717a)" }}>
              {order.product.name} • {order.quantity} {order.product.unit} • Máquina {order.machine}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Seletor de Formato */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <label style={{ fontWeight: 600 }}>Formato:</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as "sheet" | "thermal")}
              style={{ padding: "6px 10px", fontSize: 13 }}
            >
              <option value="sheet">Folha A4 (Padrão 2x3 ou grade)</option>
              <option value="thermal">Impressora Térmica (100x60mm / Rolo)</option>
            </select>
          </div>

          {/* Quantidade de Cópias / Caixas */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <label style={{ fontWeight: 600 }}>Qtd de Etiquetas:</label>
            <input
              type="number"
              min="1"
              max="50"
              value={copies}
              onChange={(e) => setCopies(Math.max(1, Number(e.target.value)))}
              style={{ width: 70, padding: "6px 8px", fontSize: 13 }}
            />
          </div>

          <button
            type="button"
            className="btn"
            onClick={() => window.print()}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Printer size={16} /> Imprimir Etiquetas
          </button>
        </div>
      </div>

      {/* Grade de Etiquetas Prontas para Impressão */}
      <div
        className={format === "thermal" ? "labels-thermal-container" : "labels-sheet-container"}
        style={
          format === "thermal"
            ? {
                display: "flex",
                flexDirection: "column",
                gap: 20,
                alignItems: "center",
              }
            : {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
                gap: 16,
              }
        }
      >
        {Array.from({ length: copies }).map((_, index) => (
          <div
            key={index}
            className="label-card"
            style={{
              background: "#ffffff",
              color: "#000000",
              border: "2px solid #000000",
              borderRadius: 6,
              padding: 14,
              boxSizing: "border-box",
              width: format === "thermal" ? "100mm" : "100%",
              minHeight: format === "thermal" ? "65mm" : "auto",
              pageBreakInside: "avoid",
              breakInside: "avoid",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            {/* Topo da Etiqueta: Empresa + Título */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1.5px solid #000",
                paddingBottom: 6,
                marginBottom: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {company.logoUrl && (
                  <img
                    src={company.logoUrl}
                    alt="Logo"
                    style={{ maxHeight: 28, maxWidth: 90, objectFit: "contain" }}
                  />
                )}
                <div>
                  <div style={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {company.tradeName || company.name}
                  </div>
                  <div style={{ fontSize: 9, color: "#444" }}>IDENTIFICAÇÃO DE PRODUTO / LOTE</div>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    border: "1px solid #000",
                    padding: "2px 6px",
                    fontSize: 10,
                    fontWeight: 700,
                    borderRadius: 3,
                  }}
                >
                  VOL: {index + 1} / {copies}
                </span>
              </div>
            </div>

            {/* Nome do Produto em Destaque */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "#555", fontWeight: 700, textTransform: "uppercase" }}>
                PRODUTO ACABADO
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.15 }}>
                {order.product.name}
              </div>
              {order.product.sku && (
                <div style={{ fontSize: 11, fontWeight: 700, color: "#222", marginTop: 1 }}>
                  SKU / CÓD: {order.product.sku}
                </div>
              )}
            </div>

            {/* Dados do Lote, Máquina, Qtd e Operador em Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.5fr 1fr",
                gap: 6,
                background: "#f8f9fa",
                border: "1px solid #ddd",
                borderRadius: 4,
                padding: "6px 8px",
                marginBottom: 8,
                fontSize: 11,
              }}
            >
              <div>
                <span style={{ color: "#666", fontSize: 9.5, display: "block" }}>ORDEM DE PRODUÇÃO:</span>
                <strong style={{ fontSize: 13, fontFamily: "monospace" }}>{order.code}</strong>
              </div>

              <div>
                <span style={{ color: "#666", fontSize: 9.5, display: "block" }}>QUANTIDADE NO LOTE:</span>
                <strong style={{ fontSize: 15, fontWeight: 900 }}>
                  {num(order.quantity)} {order.product.unit}
                </strong>
              </div>

              <div>
                <span style={{ color: "#666", fontSize: 9.5, display: "block" }}>MÁQUINA / POSTO:</span>
                <strong>{order.machine}</strong>
              </div>

              <div>
                <span style={{ color: "#666", fontSize: 9.5, display: "block" }}>LOTE INTERNO:</span>
                <strong style={{ fontFamily: "monospace" }}>{lotNumber}</strong>
              </div>

              <div>
                <span style={{ color: "#666", fontSize: 9.5, display: "block" }}>OPERADOR:</span>
                <span>{order.operatorName || "Geral"}</span>
              </div>

              <div>
                <span style={{ color: "#666", fontSize: 9.5, display: "block" }}>DATA FABRICAÇÃO:</span>
                <span>{fmtDate(order.completedAt || order.createdAt)}</span>
              </div>
            </div>

            {/* Código de Barras e QR Code da OP */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                borderTop: "1px dashed #999",
                paddingTop: 8,
                marginBottom: 8,
              }}
            >
              <div style={{ flex: 1 }}>
                <SvgBarcode text={order.code} />
              </div>
              <SvgQrCode text={`${order.code}|${order.product.sku || order.product.id}|${order.quantity}`} />
            </div>

            {/* Rodapé: Controle de Qualidade e Endereço de Armazenagem */}
            <div
              style={{
                borderTop: "1.5px solid #000",
                paddingTop: 6,
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr",
                gap: 8,
                fontSize: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 14, height: 14, border: "1.5px solid #000", borderRadius: 2 }} />
                <span>
                  <strong>CQ APROVADO</strong> / Visto: _________
                </span>
              </div>
              <div style={{ textAlign: "right" }}>
                <span>
                  Endereço Almox.: <strong>[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</strong>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Regras CSS Específicas para Impressão */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 8mm;
            size: auto;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .no-print,
          header,
          aside,
          nav,
          .sidebar,
          footer {
            display: none !important;
          }
          .label-card {
            box-shadow: none !important;
            border: 2px solid #000000 !important;
            margin-bottom: 8mm !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .labels-sheet-container {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 6mm !important;
          }
        }
      `}</style>
    </>
  );
}
