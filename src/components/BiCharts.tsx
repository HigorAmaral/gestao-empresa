"use client";

import { useState } from "react";
import { brl } from "@/lib/format";
import { BarChart3, PieChart, TrendingUp } from "lucide-react";

export interface MonthlyDataPoint {
  month: string; // Ex: "06/2026"
  receitas: number;
  despesas: number;
  lucro: number;
}

export function MonthlyFinanceChart({ data }: { data: MonthlyDataPoint[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.flatMap((d) => [d.receitas, d.despesas]), 1000);
  const chartHeight = 180;
  const barWidth = 24;
  const gap = 36;
  const chartWidth = Math.max(500, data.length * (barWidth * 2 + gap) + 40);

  return (
    <div className="card flush mb">
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <TrendingUp size={16} /> Evolução Financeira: Receitas vs. Despesas (Últimos Meses)
          </h3>
          <div className="small muted">Comparativo mensal consolidado de faturamento e custos operacionais</div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, background: "var(--primary, #09090b)", borderRadius: 2 }}></span>
            Receitas
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, background: "var(--muted, #71717a)", borderRadius: 2 }}></span>
            Despesas
          </span>
        </div>
      </div>

      <div style={{ padding: "20px 18px", overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`}
          style={{ width: "100%", minWidth: 460, height: chartHeight + 40, overflow: "visible" }}
        >
          {/* Linhas de grade horizontais */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = chartHeight - ratio * (chartHeight - 20) + 10;
            return (
              <g key={ratio}>
                <line
                  x1={30}
                  y1={y}
                  x2={chartWidth - 10}
                  y2={y}
                  stroke="var(--border)"
                  strokeDasharray={ratio === 0 ? "none" : "3,3"}
                  strokeWidth={1}
                />
                <text
                  x={24}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9.5"
                  fill="var(--muted)"
                  fontFamily="sans-serif"
                >
                  {ratio === 0 ? "0" : (maxVal * ratio >= 1000 ? `${Math.round((maxVal * ratio) / 1000)}k` : Math.round(maxVal * ratio))}
                </text>
              </g>
            );
          })}

          {/* Barras por mês */}
          {data.map((d, i) => {
            const groupX = 40 + i * (barWidth * 2 + gap);
            const recH = Math.max(3, (d.receitas / maxVal) * (chartHeight - 20));
            const despH = Math.max(3, (d.despesas / maxVal) * (chartHeight - 20));
            const recY = chartHeight - recH + 10;
            const despY = chartHeight - despH + 10;
            const isHover = hoveredIdx === i;

            return (
              <g
                key={d.month}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Destaque hover */}
                {isHover && (
                  <rect
                    x={groupX - 6}
                    y={5}
                    width={barWidth * 2 + 12}
                    height={chartHeight + 25}
                    fill="var(--surface-subtle)"
                    rx={6}
                    opacity={0.6}
                  />
                )}

                {/* Barra Receita */}
                <rect
                  x={groupX}
                  y={recY}
                  width={barWidth}
                  height={recH}
                  fill="var(--text)"
                  rx={3}
                />

                {/* Barra Despesa */}
                <rect
                  x={groupX + barWidth + 4}
                  y={despY}
                  width={barWidth}
                  height={despH}
                  fill="var(--muted)"
                  rx={3}
                  opacity={0.8}
                />

                {/* Rótulo do Mês */}
                <text
                  x={groupX + barWidth + 2}
                  y={chartHeight + 28}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={isHover ? "700" : "500"}
                  fill="var(--text)"
                  fontFamily="sans-serif"
                >
                  {d.month}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Detalhe do mês selecionado */}
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              background: "var(--surface-subtle)",
              borderRadius: 6,
              border: "1px solid var(--border)",
              display: "flex",
              gap: 20,
              fontSize: 12.5,
              flexWrap: "wrap",
            }}
          >
            <div>
              Competência: <strong>{data[hoveredIdx].month}</strong>
            </div>
            <div>
              Receitas: <strong>{brl(data[hoveredIdx].receitas)}</strong>
            </div>
            <div>
              Despesas: <strong>{brl(data[hoveredIdx].despesas)}</strong>
            </div>
            <div>
              Resultado Líquido:{" "}
              <strong style={{ color: data[hoveredIdx].lucro >= 0 ? "var(--text)" : "#ef4444" }}>
                {brl(data[hoveredIdx].lucro)}
              </strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export interface AbcProductRow {
  productId: number;
  name: string;
  sku: string;
  category: string;
  quantitySold: number;
  totalRevenue: number;
  sharePct: number;
  accumPct: number;
  classification: "A" | "B" | "C";
}

export function AbcCurveCard({ items }: { items: AbcProductRow[] }) {
  const classA = items.filter((i) => i.classification === "A");
  const classB = items.filter((i) => i.classification === "B");
  const classC = items.filter((i) => i.classification === "C");

  const totalRev = items.reduce((s, i) => s + i.totalRevenue, 0);

  return (
    <div className="card flush mb">
      <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
        <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 15 }}>
          <BarChart3 size={17} /> Curva ABC de Produtos (Princípio 80/20 de Pareto)
        </h3>
        <div className="small muted" style={{ marginTop: 4 }}>
          Classificação inteligente por faturamento: identifica quais produtos geram a maior parte da receita da sua empresa.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          padding: "16px 18px",
          background: "var(--surface-subtle)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ padding: 12, borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="badge green">CLASSE A (Até 80%)</span>
            <strong>{classA.length} itens</strong>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8 }}>
            {brl(classA.reduce((s, i) => s + i.totalRevenue, 0))}
          </div>
          <div className="small muted">Maior prioridade de compra e estoque de segurança.</div>
        </div>

        <div style={{ padding: 12, borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="badge blue">CLASSE B (80% a 95%)</span>
            <strong>{classB.length} itens</strong>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8 }}>
            {brl(classB.reduce((s, i) => s + i.totalRevenue, 0))}
          </div>
          <div className="small muted">Itens com giro intermediário e compras periódicas.</div>
        </div>

        <div style={{ padding: 12, borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="badge gray">CLASSE C (95% a 100%)</span>
            <strong>{classC.length} itens</strong>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8 }}>
            {brl(classC.reduce((s, i) => s + i.totalRevenue, 0))}
          </div>
          <div className="small muted">Itens de cauda longa. Evite excesso de compras.</div>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Classe</th>
              <th>SKU / Produto</th>
              <th>Categoria</th>
              <th className="num">Qtd. Vendida</th>
              <th className="num">Faturamento</th>
              <th className="num">% Vendas</th>
              <th className="num">% Acumulado</th>
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 30).map((p) => (
              <tr key={p.productId}>
                <td>
                  <span
                    className={`badge ${p.classification === "A" ? "green" : p.classification === "B" ? "blue" : "gray"}`}
                  >
                    Classe {p.classification}
                  </span>
                </td>
                <td className="bold">
                  <div>{p.name}</div>
                  <div className="small muted">{p.sku}</div>
                </td>
                <td className="small">{p.category || "Geral"}</td>
                <td className="num">{p.quantitySold}</td>
                <td className="num bold">{brl(p.totalRevenue)}</td>
                <td className="num">{p.sharePct.toFixed(1)}%</td>
                <td className="num bold">{p.accumPct.toFixed(1)}%</td>
              </tr>
            ))}

            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  Nenhuma venda com itens registrada no período para calcular a Curva ABC.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
