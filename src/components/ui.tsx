import Link from "next/link";
import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { STATUS_LABEL } from "@/lib/format";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

/** Botão para exportar a tabela em CSV (compatível com Excel PT-BR). */
export function ExportCsvButton({ entity, label = "Exportar CSV" }: { entity: string; label?: string }) {
  return (
    <a className="btn secondary" href={`/api/export?entity=${encodeURIComponent(entity)}`} download>
      <Download size={15} /> {label}
    </a>
  );
}

/** Mostra mensagens ?erro= e ?ok= vindas de redirects. */
export function FlashMessages({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const erro = typeof sp.erro === "string" ? sp.erro : null;
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  return (
    <>
      {erro && (
        <div className="alert error" role="alert" aria-live="assertive">
          <AlertCircle size={17} aria-hidden="true" /> {erro}
        </div>
      )}
      {ok && (
        <div className="alert success" role="status" aria-live="polite">
          <CheckCircle2 size={17} aria-hidden="true" /> {ok}
        </div>
      )}
    </>
  );
}

const BADGE_COLOR: Record<string, string> = {
  ORCAMENTO: "yellow",
  CONFIRMADA: "green",
  CANCELADA: "red",
  CANCELADO: "red",
  PENDENTE: "yellow",
  RECEBIDA: "green",
  PAGO: "green",
  VENCIDO: "red",
  RECEITA: "green",
  DESPESA: "red",
  ENTRADA: "green",
  SAIDA: "red",
  AJUSTE: "blue",
  ADMIN: "purple",
  FUNCIONARIO: "blue",
  ABERTA: "yellow",
  EM_ANDAMENTO: "blue",
  AGUARDANDO_PECA: "yellow",
  CONCLUIDA: "green",
  PLANEJADA: "purple",
  EM_PRODUCAO: "blue",
  RECEBIDO: "green",
  BAIXA: "gray",
  NORMAL: "blue",
  ALTA: "yellow",
  URGENTE: "red",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${BADGE_COLOR[status] ?? "gray"}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <span className={`badge ${active ? "green" : "gray"}`}>{active ? "Ativo" : "Inativo"}</span>;
}

export function Pagination({
  basePath,
  sp,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  sp: Record<string, string | string[] | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (typeof v === "string" && v && k !== "page" && k !== "erro" && k !== "ok") params.set(k, v);
    }
    params.set(
      "page",
      String(p),
    );
    return `${basePath}?${params.toString()}`;
  };
  return (
    <nav className="pagination" aria-label="Paginação">
      <span>
        {total} registro(s) — página {page} de {pages}
      </span>
      <div className="pages">
        {page > 1 && (
          <Link className="btn sm secondary" href={href(page - 1)} aria-label="Página anterior">
            <ChevronLeft size={14} aria-hidden="true" /> Anterior
          </Link>
        )}
        {page < pages && (
          <Link className="btn sm secondary" href={href(page + 1)} aria-label="Próxima página">
            Próxima <ChevronRight size={14} aria-hidden="true" />
          </Link>
        )}
      </div>
    </nav>
  );
}

export type BarSeries = { label: string; color?: "green" | "red" | ""; values: number[] };

/** Gráfico de barras em CSS no tema Preto & Branco (sólido vs listrado). */
export function BarChart({
  labels,
  series,
  format = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }),
}: {
  labels: string[];
  series: BarSeries[];
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  return (
    <div role="region" aria-label="Gráfico comparativo de valores">
      {series.length > 1 && (
        <div className="legend mb">
          {series.map((s) => (
            <span key={s.label}>
              <i className={`swatch ${s.color === "red" ? "striped" : ""}`} aria-hidden="true" />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div className="bars" aria-hidden="true">
        {labels.map((label, i) => (
          <div className="bar-col" key={label}>
            {series.length === 1 && <div className="bar-value">{format(series[0].values[i])}</div>}
            <div className="bar-group">
              {series.map((s) => (
                <div
                  key={s.label}
                  className={`bar ${s.color ?? ""}`}
                  style={{ height: `${(s.values[i] / max) * 100}%` }}
                  title={`${s.label}: ${format(s.values[i])}`}
                />
              ))}
            </div>
            <div className="bar-label">{label}</div>
          </div>
        ))}
      </div>
      <ul className="sr-only">
        {labels.map((label, i) => (
          <li key={label}>
            {label}: {series.map((s) => `${s.label} ${format(s.values[i])}`).join(", ")}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HBarList({
  rows,
  format,
}: {
  rows: { name: string; value: number }[];
  format: (v: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <div className="empty">Sem dados no período.</div>;
  return (
    <div className="hbar-list">
      {rows.map((r, i) => (
        <div className="hbar" key={r.name + i}>
          <div className="name" title={r.name}>
            {r.name}
          </div>
          <div className="track">
            <div className="fill" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <div className="val">{format(r.value)}</div>
        </div>
      ))}
    </div>
  );
}
