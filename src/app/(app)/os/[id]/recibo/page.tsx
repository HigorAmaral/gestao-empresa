import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "@/lib/audit";
import { brl, fmtDate, fmtDateTime, num, STATUS_LABEL } from "@/lib/format";
import { PageHeader, StatusBadge } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { PixQrBox } from "@/components/PixQrBox";

export default async function ServiceOrderReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [os, company] = await Promise.all([
    prisma.serviceOrder.findUnique({
      where: { id: Number(id) },
      include: { items: { include: { product: true } }, client: true, technician: true },
    }),
    getCompanySettings(),
  ]);
  if (!os) notFound();

  return (
    <>
      <PageHeader
        title={`Comprovante da OS #${os.id}`}
        subtitle="Pronto para impressão em folha A4 ou exportação em PDF"
        actions={
          <>
            <Link className="btn secondary" href={`/os/${os.id}`}>
              <ArrowLeft size={15} /> Voltar à OS
            </Link>
            <PrintButton label="Imprimir OS" />
          </>
        }
      />

      <div className="print-doc">
        <div className="doc-header">
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {company.logoUrl && (
              <img
                src={company.logoUrl}
                alt={company.tradeName || company.name}
                style={{ maxHeight: 85, maxWidth: 220, objectFit: "contain", borderRadius: 6, flexShrink: 0 }}
              />
            )}
            <div>
              <h1>{company.tradeName || company.name}</h1>
              <div className="small muted">{company.name}</div>
              {company.document && <div className="small">CNPJ: {company.document}</div>}
              <div className="small">
                {[company.address, company.city, company.state].filter(Boolean).join(" · ")}
              </div>
              <div className="small">
                {[company.phone, company.email].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
          <div className="doc-title">
            <h2>ORDEM DE SERVIÇO #{os.id}</h2>
            <div className="small">Abertura: {fmtDate(os.openedAt)}</div>
            {os.expectedDate && <div className="small">Previsão: {fmtDate(os.expectedDate)}</div>}
            {os.completedAt && <div className="small">Conclusão: {fmtDateTime(os.completedAt)}</div>}
            <div style={{ marginTop: 6 }}>
              <StatusBadge status={os.status} />
            </div>
          </div>
        </div>

        <div className="grid grid-2">
          <div>
            <div className="small muted bold">DADOS DO CLIENTE</div>
            <div className="bold">{os.client?.name ?? "Cliente avulso"}</div>
            {os.client?.document && <div className="small">CPF/CNPJ: {os.client.document}</div>}
            {os.client?.phone && <div className="small">Tel.: {os.client.phone}</div>}
            {os.client?.address && (
              <div className="small">
                {[os.client.address, os.client.city, os.client.state].filter(Boolean).join(" — ")}
              </div>
            )}
          </div>
          <div>
            <div className="small muted bold">EQUIPAMENTO / ATENDIMENTO</div>
            <div className="bold">{os.equipment}</div>
            {os.serialNumber && <div className="small">Nº de Série / Identificação: {os.serialNumber}</div>}
            <div className="small">Prioridade: {STATUS_LABEL[os.priority] ?? os.priority}</div>
            <div className="small">Técnico: {os.technician?.name ?? "—"}</div>
          </div>
        </div>

        <div className="doc-section">
          <div className="small muted bold">DEFEITO / SOLICITAÇÃO RELATADA</div>
          <div>{os.reportedIssue}</div>
        </div>

        <div className="doc-section">
          <div className="small muted bold">DIAGNÓSTICO TÉCNICO / SERVIÇO EXECUTADO</div>
          <div>{os.diagnosis || "Em análise técnica."}</div>
        </div>

        {os.items.length > 0 && (
          <div className="doc-section">
            <div className="small muted bold mb">PEÇAS E PRODUTOS APLICADOS</div>
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th className="num">Qtd.</th>
                  <th className="num">Unitário</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {os.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.product.sku}</td>
                    <td>{it.product.name}</td>
                    <td className="num">
                      {num(it.quantity)} {it.product.unit}
                    </td>
                    <td className="num">{brl(it.unitPrice)}</td>
                    <td className="num">{brl(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="doc-section">
          <div className="totals">
            <div className="line">
              <span>Peças / Produtos</span>
              <span>{brl(os.partsSubtotal)}</span>
            </div>
            <div className="line">
              <span>Mão de obra</span>
              <span>{brl(os.laborCost)}</span>
            </div>
            {os.discount > 0 && (
              <div className="line">
                <span>Desconto</span>
                <span>− {brl(os.discount)}</span>
              </div>
            )}
            <div className="line total">
              <span>Total da OS</span>
              <span>{brl(os.total)}</span>
            </div>
            {os.paymentMethod && (
              <div className="small muted" style={{ textAlign: "right", marginTop: 4 }}>
                Forma de pagamento: {os.paymentMethod}
              </div>
            )}
          </div>
        </div>

        {os.notes && (
          <div className="doc-section">
            <div className="small muted bold">OBSERVAÇÕES / TERMOS</div>
            <div className="small">{os.notes}</div>
          </div>
        )}

        {(company.pixKey || company.document) && os.total > 0 && (
          <div className="doc-section">
            <PixQrBox
              pixKey={company.pixKey || company.document || ""}
              merchantName={company.tradeName || company.name}
              merchantCity={company.city}
              amount={os.total}
              txid={`OS${os.id}`}
            />
          </div>
        )}

        <div className="signatures">
          <div className="sig-line">{company.tradeName || company.name} — Responsável Técnico</div>
          <div className="sig-line">{os.client?.name || "Assinatura do Cliente"}</div>
        </div>

        {company.receiptFooter && <div className="doc-footer">{company.receiptFooter}</div>}
      </div>
    </>
  );
}
