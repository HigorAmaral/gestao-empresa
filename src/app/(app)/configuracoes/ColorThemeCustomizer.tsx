"use client";

import { useState } from "react";
import { Check, Palette, RefreshCw, Sparkles } from "lucide-react";

type ThemePreset = {
  name: string;
  label: string;
  primary: string;
  sidebar: string;
  accent: string;
};

const PRESETS: ThemePreset[] = [
  {
    name: "mono",
    label: "🖤 Monocromático (Padrão)",
    primary: "#09090b",
    sidebar: "#09090b",
    accent: "#2563eb",
  },
  {
    name: "blue",
    label: "🔵 Azul Corporativo",
    primary: "#1d4ed8",
    sidebar: "#0f172a",
    accent: "#38bdf8",
  },
  {
    name: "emerald",
    label: "🟢 Verde Esmeralda",
    primary: "#059669",
    sidebar: "#064e3b",
    accent: "#10b981",
  },
  {
    name: "indigo",
    label: "🟣 Roxo & Índigo",
    primary: "#6366f1",
    sidebar: "#1e1b4b",
    accent: "#a855f7",
  },
  {
    name: "orange",
    label: "🟠 Laranja Industrial",
    primary: "#ea580c",
    sidebar: "#18181b",
    accent: "#f97316",
  },
  {
    name: "bordeaux",
    label: "🔴 Bordô Executivo",
    primary: "#991b1b",
    sidebar: "#450a0a",
    accent: "#ef4444",
  },
  {
    name: "slate",
    label: "🌑 Grafite & Ciano",
    primary: "#334155",
    sidebar: "#0f172a",
    accent: "#06b6d4",
  },
];

export function ColorThemeCustomizer({
  initialPrimary = "#09090b",
  initialSidebar = "#09090b",
  initialAccent = "#2563eb",
}: {
  initialPrimary?: string | null;
  initialSidebar?: string | null;
  initialAccent?: string | null;
}) {
  const [primary, setPrimary] = useState<string>(initialPrimary || "#09090b");
  const [sidebar, setSidebar] = useState<string>(initialSidebar || "#09090b");
  const [accent, setAccent] = useState<string>(initialAccent || "#2563eb");

  function applyPreset(p: ThemePreset) {
    setPrimary(p.primary);
    setSidebar(p.sidebar);
    setAccent(p.accent);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Inputs Ocultos enviados no FormData para o Server Action */}
      <input type="hidden" name="primaryColor" value={primary} />
      <input type="hidden" name="sidebarColor" value={sidebar} />
      <input type="hidden" name="accentColor" value={accent} />

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Palette size={18} />
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Cores do Sistema & Personalização Visual</h3>
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
          Personalize a identidade visual do site escolhendo uma paleta pré-definida ou definindo cores personalizadas para botões, menus e destaques.
        </p>
      </div>

      {/* Paletas / Presets Prontos */}
      <div>
        <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 8, color: "var(--text)" }}>
          Paletas Rápidas (1 clique para aplicar)
        </label>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 10,
          }}
        >
          {PRESETS.map((p) => {
            const isSelected = primary === p.primary && sidebar === p.sidebar && accent === p.accent;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p)}
                style={{
                  background: isSelected ? "var(--surface-subtle, #f4f4f5)" : "var(--surface, #ffffff)",
                  border: isSelected ? "2px solid var(--text)" : "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 10px",
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "all 0.15s ease",
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{p.label}</div>
                  <div style={{ display: "flex", gap: 5, marginTop: 5 }}>
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        background: p.sidebar,
                        border: "1px solid #ccc",
                      }}
                      title="Barra Lateral"
                    />
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        background: p.primary,
                        border: "1px solid #ccc",
                      }}
                      title="Cor Primária"
                    />
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        background: p.accent,
                        border: "1px solid #ccc",
                      }}
                      title="Destaque"
                    />
                  </div>
                </div>
                {isSelected && <Check size={16} style={{ color: "var(--text)" }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Seletores de Cor Customizados e Preview Lado a Lado */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* Controles de Cor */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Cor Primária */}
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 12,
              background: "var(--surface)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Cor Primária (Botões & Ações)</label>
              <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--muted)" }}>{primary}</span>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="color"
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                style={{
                  width: 44,
                  height: 38,
                  padding: 2,
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                }}
              />
              <input
                type="text"
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                placeholder="#09090b"
                style={{ flex: 1, padding: "8px 10px", fontSize: 13, fontFamily: "monospace" }}
              />
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
              Define a cor de fundo dos botões principais, cabeçalhos de status e barras de destaque.
            </div>
          </div>

          {/* Cor da Barra Lateral */}
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 12,
              background: "var(--surface)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Cor da Barra Lateral (Menu & Topo Mobile)</label>
              <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--muted)" }}>{sidebar}</span>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="color"
                value={sidebar}
                onChange={(e) => setSidebar(e.target.value)}
                style={{
                  width: 44,
                  height: 38,
                  padding: 2,
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                }}
              />
              <input
                type="text"
                value={sidebar}
                onChange={(e) => setSidebar(e.target.value)}
                placeholder="#09090b"
                style={{ flex: 1, padding: "8px 10px", fontSize: 13, fontFamily: "monospace" }}
              />
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
              Fundo do menu lateral de navegação e barra superior móvel.
            </div>
          </div>

          {/* Cor de Destaque / Accent */}
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 12,
              background: "var(--surface)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Cor de Destaque / Realce (Links & Alertas)</label>
              <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--muted)" }}>{accent}</span>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                style={{
                  width: 44,
                  height: 38,
                  padding: 2,
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                }}
              />
              <input
                type="text"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                placeholder="#2563eb"
                style={{ flex: 1, padding: "8px 10px", fontSize: 13, fontFamily: "monospace" }}
              />
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
              Usada em links ativos, indicadores de foco, ícones especiais e tags de realce.
            </div>
          </div>
        </div>

        {/* Pré-visualização Ao Vivo (Live Preview) */}
        <div>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 8, color: "var(--text)" }}>
            Pré-visualização em Tempo Real
          </label>
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
              background: "#fafafa",
              boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
            }}
          >
            {/* Header da janela simulada */}
            <div
              style={{
                background: "#f4f4f5",
                padding: "8px 14px",
                borderBottom: "1px solid #e4e4e7",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#ef4444" }} />
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#f59e0b" }} />
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#10b981" }} />
              <span style={{ fontSize: 11, color: "#71717a", marginLeft: 8, fontFamily: "monospace" }}>
                sistema.seusite.com.br
              </span>
            </div>

            {/* Layout Interno Simulado */}
            <div style={{ display: "flex", minHeight: 220 }}>
              {/* Barra Lateral Simulada */}
              <div
                style={{
                  width: 110,
                  background: sidebar,
                  color: "#ffffff",
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  fontSize: 11,
                  transition: "background 0.2s ease",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 11.5, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
                  GestãoPro
                </div>
                <div
                  style={{
                    background: "#ffffff",
                    color: "#09090b",
                    padding: "4px 8px",
                    borderRadius: 4,
                    fontWeight: 700,
                  }}
                >
                  Dashboard
                </div>
                <div style={{ opacity: 0.8, padding: "2px 8px" }}>Vendas</div>
                <div style={{ opacity: 0.8, padding: "2px 8px" }}>Estoque</div>
                <div style={{ opacity: 0.8, padding: "2px 8px" }}>Produção</div>
              </div>

              {/* Área de Conteúdo Simulada */}
              <div style={{ flex: 1, padding: 14, background: "#ffffff", display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Visão Geral da Empresa</div>
                  <div style={{ fontSize: 10.5, color: "#71717a" }}>Exemplo de elementos com as novas cores</div>
                </div>

                {/* Botões e Badges Simulados */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    style={{
                      background: primary,
                      color: "#ffffff",
                      border: `1px solid ${primary}`,
                      borderRadius: 6,
                      padding: "6px 12px",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "default",
                      transition: "background 0.2s ease",
                    }}
                  >
                    Botão Principal
                  </button>

                  <span
                    style={{
                      background: `${accent}18`,
                      color: accent,
                      border: `1px solid ${accent}`,
                      borderRadius: 999,
                      padding: "2px 8px",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    ★ Destaque Ativo
                  </span>
                </div>

                {/* Card Simulado */}
                <div
                  style={{
                    background: "#fcfcfc",
                    border: "1px solid #e4e4e7",
                    borderRadius: 6,
                    padding: "8px 10px",
                    fontSize: 11,
                  }}
                >
                  <div style={{ color: "#71717a", fontSize: 9.5 }}>FATURAMENTO MENSAL</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: primary, marginTop: 2 }}>
                    R$ 48.950,00
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
