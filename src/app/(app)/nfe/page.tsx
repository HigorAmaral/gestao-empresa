import Link from "next/link";
import type { Prisma } from "@prisma/client";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  FileCheck,
  FileText,
  Filter,
  Plus,
  Printer,
  Search,
  Settings,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { pageParams, spStr } from "@/lib/form";
import { fmtDate, fmtDateTime, num } from "@/lib/format";
import { ExportCsvButton, FlashMessages, PageHeader, Pagination, StatusBadge } from "@/components/ui";
import { getCompanySettings } from "@/lib/audit";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { formatAccessKey } from "@/lib/nfe/chavenfe";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function NfePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = spStr(sp, "q");
  const status = spStr(sp, "status");
  const { page, skip, take, pageSize } = pageParams(sp);

  await ensureStockLocationTables();

  const [company] = await Promise.all([getCompanySettings()]);

  const where: Prisma.InvoiceWhereInput = {
    ...(q && {
      OR: [
        { accessKey: { contains: q } },
        { protocol: { contains: q } },
        { client: { name: { contains: q } } },
        { client: { document: { contains: q } } },
      ],
    }),
    ...(status && { status }),
  };

  const [invoices, total, totalAuthorized, totalAuthorizedSum] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: [{ number: "desc" }, { id: "desc" }],
      skip,
      take,
      include: {
        client: true,
        user: true,
        sale: true,
        items: true,
      },
    }),
    prisma.invoice.count({ where }),
    prisma.invoice.count({ where: { status: "AUTORIZADA" } }),
    prisma.invoice.aggregate({
      where: { status: "AUTORIZADA" },
      _sum: { totalInvoice: true },
    }),
  ]);

  const environmentLabel = company.nfeEnvironment === "PRODUCAO" ? "Produção (Oficial)" : "Homologação (Testes)";

  return (
    <>
      <PageHeader
        title="Notas Fiscais Eletrônicas (NF-e Modelo 55)"
        subtitle="Emissão de notas fiscais autorizadas pela SEFAZ, controle de chaves de acesso, DANFE e arquivos XML"
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Link className="btn secondary" href="/nfe/configuracoes">
              <Settings size={15} /> Configurações Fiscais
            </Link>
            <Link className="btn" href="/vendas">
              <Plus size={15} /> Emitir a partir de Venda
            </Link>
          </div>
        }
      />

      <FlashMessages sp={sp} />

      {/* Estatísticas Fiscais */}
      <div className="stats">
        <div className="stat primary">
          <div className="label">Total Faturado em NF-e</div>
          <div className="value">R$ {num(totalAuthorizedSum._sum.totalInvoice || 0)}</div>
          <div className="hint">Notas fiscais autorizadas</div>
        </div>
        <div className="stat">
          <div className="label">Notas Autorizadas</div>
          <div className="value">{totalAuthorized}</div>
          <div className="hint">Prontas para download e envio</div>
        </div>
        <div className="stat">
          <div className="label">Ambiente SEFAZ Ativo</div>
          <div className="value" style={{ fontSize: 16 }}>{environmentLabel}</div>
          <div className="hint">Série {company.nfeSeries || 1} • Próximo Nº: {company.nfeNextNumber || 1}</div>
        </div>
        <div className="stat">
          <div className="label">Regime Tributário</div>
          <div className="value" style={{ fontSize: 16 }}>
            {company.taxRegime === "1" ? "Simples Nacional" : "Regime Normal"}
          </div>
          <div className="hint">CNPJ: {company.document || "Não cadastrado"}</div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <form className="filters" method="get">
        <div className="input-icon" style={{ flex: 1 }}>
          <Search size={16} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por Chave de 44 dígitos, Protocolo, Nome do Cliente ou CPF/CNPJ..."
          />
        </div>
        <select name="status" defaultValue={status}>
          <option value="">Todos os status</option>
          <option value="AUTORIZADA">Autorizada</option>
          <option value="CANCELADA">Cancelada</option>
          <option value="PROCESSANDO">Processando</option>
          <option value="REJEITADA">Rejeitada</option>
        </select>
        <button type="submit" className="btn secondary">
          Filtrar
        </button>
        {(q || status) && (
          <Link href="/nfe" className="btn ghost">
            Limpar
          </Link>
        )}
      </form>

      {/* Tabela de Notas Fiscais */}
      <div className="card table-responsive">
        <table>
          <thead>
            <tr>
              <th>Nº / Série</th>
              <th>Destinatário</th>
              <th>Data Emissão</th>
              <th style={{ textAlign: "right" }}>Valor Total</th>
              <th>Chave de Acesso SEFAZ</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "36px 0", color: "var(--muted)" }}>
                  <FileText size={36} style={{ margin: "0 auto 8px", opacity: 0.35, display: "block" }} />
                  Nenhuma nota fiscal emitida ainda. Para emitir uma NF-e, acesse qualquer venda confirmada em{" "}
                  <Link href="/vendas" style={{ fontWeight: 600 }}>
                    Vendas
                  </Link>{" "}
                  e clique em <strong>"Emitir NF-e"</strong>.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <Link href={`/nfe/${inv.id}`} style={{ fontWeight: 700, fontFamily: "monospace", fontSize: 13.5 }}>
                      NF-e #{inv.number}
                    </Link>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>Série {inv.series}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{inv.client?.name || "Consumidor Final"}</div>
                    {inv.client?.document && (
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{inv.client.document}</div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontSize: 13 }}>{fmtDate(inv.createdAt)}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{inv.environment}</div>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>
                    R$ {num(inv.totalInvoice)}
                  </td>
                  <td>
                    {inv.accessKey ? (
                      <div>
                        <div style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 600 }}>
                          {formatAccessKey(inv.accessKey).slice(0, 24)}...
                        </div>
                        {inv.protocol && (
                          <div style={{ fontSize: 10.5, color: "var(--muted)" }}>Prot: {inv.protocol}</div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td>
                    {inv.status === "AUTORIZADA" ? (
                      <span className="badge green" style={{ fontSize: 11 }}>
                        <CheckCircle2 size={11} style={{ marginRight: 3 }} /> Autorizada
                      </span>
                    ) : inv.status === "CANCELADA" ? (
                      <span className="badge red" style={{ fontSize: 11 }}>
                        <XCircle size={11} style={{ marginRight: 3 }} /> Cancelada
                      </span>
                    ) : (
                      <StatusBadge status={inv.status} />
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className="row justify-end" style={{ gap: 6 }}>
                      <Link
                        className="btn secondary"
                        style={{ padding: "4px 8px", fontSize: 12 }}
                        href={`/nfe/${inv.id}/danfe`}
                        title="Imprimir DANFE Oficial da NF-e"
                      >
                        <Printer size={13} /> DANFE
                      </Link>
                      <a
                        className="btn secondary"
                        style={{ padding: "4px 8px", fontSize: 12 }}
                        href={`/nfe/${inv.id}/xml`}
                        download={`NFe-${inv.accessKey || inv.number}.xml`}
                        title="Baixar XML com protocolo SEFAZ"
                      >
                        <Download size={13} /> XML
                      </a>
                      <Link
                        className="btn ghost"
                        style={{ padding: "4px 8px", fontSize: 12 }}
                        href={`/nfe/${inv.id}`}
                      >
                        Ver →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination basePath="/nfe" sp={sp} page={page} pageSize={pageSize} total={total} />
    </>
  );
}
