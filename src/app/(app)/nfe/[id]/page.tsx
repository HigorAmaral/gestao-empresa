import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileCheck,
  FileText,
  HelpCircle,
  Printer,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "@/lib/audit";
import { fmtDate, fmtDateTime, num } from "@/lib/format";
import { FlashMessages, PageHeader, StatusBadge } from "@/components/ui";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { formatAccessKey } from "@/lib/nfe/chavenfe";
import { cancelInvoice } from "../actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SP;
}) {
  const { id } = await params;
  const sp = await searchParams;

  await ensureStockLocationTables();

  const [invoice, company] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id: Number(id) },
      include: {
        client: true,
        user: true,
        sale: true,
        items: {
          include: { product: true },
        },
      },
    }),
    getCompanySettings(),
  ]);

  if (!invoice) notFound();

  const accessKey = invoice.accessKey || "";
  const formattedKey = formatAccessKey(accessKey);

  return (
    <>
      <PageHeader
        title={`Nota Fiscal Eletrônica nº ${invoice.number} (Série ${invoice.series})`}
        subtitle={`Modelo 55 • Emitida em ${fmtDateTime(invoice.createdAt)} • Ambiente: ${invoice.environment}`}
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Link className="btn secondary" href="/nfe">
              <ArrowLeft size={15} /> Voltar à lista
            </Link>
            <Link className="btn secondary" href={`/nfe/${invoice.id}/danfe`}>
              <Printer size={15} /> Imprimir DANFE
            </Link>
            <a
              className="btn secondary"
              href={`/nfe/${invoice.id}/xml`}
              download={`NFe-${invoice.accessKey || invoice.number}.xml`}
            >
              <Download size={15} /> Baixar XML Oficial
            </a>
          </div>
        }
      />

      <FlashMessages sp={sp} />

      {/* Card de Status da SEFAZ */}
      <div
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20,
          background: invoice.status === "AUTORIZADA" ? "#f0fdf4" : invoice.status === "CANCELADA" ? "#fef2f2" : "var(--surface-subtle)",
          border: `1px solid ${invoice.status === "AUTORIZADA" ? "#bbf7d0" : invoice.status === "CANCELADA" ? "#fecaca" : "var(--border)"}`,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 16 }}>Status na SEFAZ:</span>
            {invoice.status === "AUTORIZADA" ? (
              <span className="badge green" style={{ fontSize: 13 }}>
                <CheckCircle2 size={14} style={{ marginRight: 4 }} /> 100 - Autorizado o uso da NF-e
              </span>
            ) : invoice.status === "CANCELADA" ? (
              <span className="badge red" style={{ fontSize: 13 }}>
                <XCircle size={14} style={{ marginRight: 4 }} /> 135 - Evento: Cancelamento Homologado
              </span>
            ) : (
              <StatusBadge status={invoice.status} />
            )}
          </div>

          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
            {invoice.protocol && (
              <span>
                <strong>Protocolo de Autorização:</strong> {invoice.protocol} em {fmtDateTime(invoice.authorizedAt || invoice.createdAt)}
              </span>
            )}
            {invoice.cancelReason && (
              <div style={{ color: "#b91c1c", marginTop: 4 }}>
                <strong>Motivo do Cancelamento:</strong> {invoice.cancelReason} (em {fmtDateTime(invoice.canceledAt)})
              </div>
            )}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>VALOR TOTAL DA NOTA</div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>R$ {num(invoice.totalInvoice)}</div>
        </div>
      </div>

      {/* Bloco de Chave de Acesso Oficial de 44 Dígitos */}
      {accessKey && (
        <div className="card" style={{ marginBottom: 20, background: "#fafafa" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                Chave de Acesso Oficial (44 Dígitos)
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, fontFamily: "monospace", letterSpacing: 1, marginTop: 4 }}>
                {formattedKey}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <a
                href={`https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo&tipoConteudo=7PhJ+gAVw2g=&nfe=${accessKey}`}
                target="_blank"
                rel="noreferrer"
                className="btn secondary"
                style={{ fontSize: 12.5 }}
                title="Consultar no Portal Nacional da Receita Federal / SEFAZ"
              >
                <ShieldCheck size={14} /> Consultar na Receita Federal →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Grid com Dados do Emitente e Destinatário */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 20 }}>
        {/* Emitente */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Dados do Emitente (Sua Empresa)</h3>
          <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
            <div><strong>Razão Social:</strong> {company.name}</div>
            {company.tradeName && <div><strong>Nome Fantasia:</strong> {company.tradeName}</div>}
            <div><strong>CNPJ:</strong> {company.document || "Não cadastrado"}</div>
            <div><strong>Inscrição Estadual:</strong> {company.stateRegistration || "ISENTO"}</div>
            <div><strong>Endereço:</strong> {company.address}, {company.city} - {company.state}</div>
            <div><strong>Regime Tributário:</strong> {company.taxRegime === "1" ? "Simples Nacional (CRT 1)" : "Regime Normal (CRT 3)"}</div>
          </div>
        </div>

        {/* Destinatário */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Dados do Destinatário (Cliente)</h3>
          <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
            <div><strong>Nome / Razão Social:</strong> {invoice.client?.name || "Consumidor Final"}</div>
            <div><strong>CPF / CNPJ:</strong> {invoice.client?.document || "Não informado"}</div>
            <div><strong>Inscrição Estadual:</strong> {invoice.client?.ie || "ISENTO"}</div>
            <div><strong>Endereço:</strong> {invoice.client?.address || "Não informado"}, {invoice.client?.city} - {invoice.client?.state}</div>
            {invoice.client?.email && <div><strong>E-mail:</strong> {invoice.client.email}</div>}
            {invoice.saleId && (
              <div style={{ marginTop: 6 }}>
                <strong>Venda de Origem: </strong>
                <Link href={`/vendas/${invoice.saleId}`} style={{ fontWeight: 600 }}>
                  Venda #{invoice.saleId}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabela de Produtos / Itens da NF-e */}
      <div className="card table-responsive" style={{ marginBottom: 20 }}>
        <div style={{ padding: "8px 0 14px" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Produtos & Tributos da Nota Fiscal</h3>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Produto / Descrição</th>
              <th style={{ width: 100 }}>NCM</th>
              <th style={{ width: 70 }}>CFOP</th>
              <th style={{ width: 60 }}>CSOSN</th>
              <th style={{ width: 60 }}>UN</th>
              <th style={{ width: 80, textAlign: "right" }}>Qtd</th>
              <th style={{ width: 100, textAlign: "right" }}>Vl. Unitário</th>
              <th style={{ width: 110, textAlign: "right" }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it) => (
              <tr key={it.id}>
                <td>{it.itemNumber}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{it.name}</div>
                  {it.sku && <div style={{ fontSize: 11, color: "var(--muted)" }}>SKU: {it.sku}</div>}
                </td>
                <td style={{ fontFamily: "monospace" }}>{it.ncm}</td>
                <td style={{ fontFamily: "monospace" }}>{it.cfop}</td>
                <td>{it.csosn || "102"}</td>
                <td>{it.unit}</td>
                <td style={{ textAlign: "right" }}>{num(it.quantity)}</td>
                <td style={{ textAlign: "right" }}>R$ {num(it.unitPrice)}</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>R$ {num(it.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "var(--surface-subtle)", fontWeight: 700 }}>
              <td colSpan={7}>Total dos Produtos</td>
              <td colSpan={2} style={{ textAlign: "right" }}>R$ {num(invoice.totalProducts)}</td>
            </tr>
            {invoice.totalDiscount > 0 && (
              <tr>
                <td colSpan={7} style={{ color: "#b91c1c" }}>Desconto Comercial</td>
                <td colSpan={2} style={{ textAlign: "right", color: "#b91c1c" }}>- R$ {num(invoice.totalDiscount)}</td>
              </tr>
            )}
            <tr style={{ fontSize: 15, fontWeight: 900 }}>
              <td colSpan={7}>VALOR TOTAL DA NF-E</td>
              <td colSpan={2} style={{ textAlign: "right" }}>R$ {num(invoice.totalInvoice)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Cancelamento da NF-e (se autorizada) */}
      {invoice.status === "AUTORIZADA" && (
        <div className="card" style={{ border: "1px dashed #ef4444", background: "#fef2f2" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#991b1b", marginBottom: 6 }}>
            Cancelar Nota Fiscal perante a SEFAZ
          </h3>
          <p style={{ fontSize: 12.5, color: "#7f1d1d", margin: "0 0 12px" }}>
            Conforme legislação da SEFAZ, o cancelamento só pode ser realizado caso a mercadoria ainda não tenha saído do estabelecimento e dentro do prazo legal. A justificativa deve conter no mínimo 15 caracteres.
          </p>

          <form action={cancelInvoice.bind(null, invoice.id)} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="text"
              name="justification"
              placeholder="Justificativa do cancelamento (mínimo 15 caracteres)..."
              required
              minLength={15}
              style={{ flex: 1, minWidth: 280, padding: "8px 12px", fontSize: 13 }}
            />
            <button
              type="submit"
              className="btn"
              style={{ background: "#dc2626", borderColor: "#dc2626", color: "#fff" }}
            >
              Confirmar Cancelamento na SEFAZ
            </button>
          </form>
        </div>
      )}
    </>
  );
}
