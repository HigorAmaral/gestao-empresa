import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "@/lib/audit";
import { brl, fmtDate, num } from "@/lib/format";
import { PageHeader, StatusBadge } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";

export default async function SaleReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [sale, company] = await Promise.all([
    prisma.sale.findUnique({
      where: { id: Number(id) },
      include: { items: { include: { product: true } }, client: true, user: true },
    }),
    getCompanySettings(),
  ]);
  if (!sale) notFound();

  const docType = sale.status === "ORCAMENTO" ? "ORÇAMENTO COMERCIAL" : "PEDIDO / RECIBO DE VENDA";

  return (
    <>
      <PageHeader
        title={`${sale.status === "ORCAMENTO" ? "Orçamento" : "Recibo de Venda"} #${sale.id}`}
        subtitle="Pronto para impressão em A4 ou geração de PDF"
        actions={
          <>
            <Link className="btn secondary" href={`/vendas/${sale.id}`}>
              <ArrowLeft size={15} /> Voltar à venda
            </Link>
            <PrintButton label="Imprimir Recibo / PDF" />
          </>
        }
      />

      <div className="print-doc">
        <div className="doc-header">
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
          <div className="doc-title">
            <h2>
              {docType} #{sale.id}
            </h2>
            <div className="small">Data: {fmtDate(sale.date)}</div>
            <div className="small">Vendedor: {sale.user?.name ?? "—"}</div>
            <div style={{ marginTop: 6 }}>
              <StatusBadge status={sale.status} />
            </div>
          </div>
        </div>

        <div className="grid grid-2">
          <div>
            <div className="small muted bold">DESTINATÁRIO / CLIENTE</div>
            <div className="bold">{sale.client?.name ?? "Consumidor final"}</div>
            {sale.client?.document && <div className="small">CPF/CNPJ: {sale.client.document}</div>}
            {sale.client?.phone && <div className="small">Tel.: {sale.client.phone}</div>}
            {sale.client?.email && <div className="small">E-mail: {sale.client.email}</div>}
          </div>
          <div>
            <div className="small muted bold">ENDEREÇO E PAGAMENTO</div>
            <div className="small">
              {sale.client?.address
                ? [sale.client.address, sale.client.city, sale.client.state].filter(Boolean).join(" — ")
                : "Endereço não informado"}
            </div>
            <div className="small" style={{ marginTop: 6 }}>
              <strong>Forma de pagamento:</strong> {sale.paymentMethod ?? "A definir"}
            </div>
          </div>
        </div>

        <div className="doc-section">
          <div className="small muted bold mb">ITENS DO PEDIDO</div>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Descrição do Produto / Serviço</th>
                <th className="num">Qtd.</th>
                <th className="num">Preço Unit.</th>
                <th className="num">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((it) => (
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

        <div className="doc-section">
          <div className="totals">
            <div className="line">
              <span>Subtotal dos itens</span>
              <span>{brl(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="line">
                <span>Desconto</span>
                <span>− {brl(sale.discount)}</span>
              </div>
            )}
            <div className="line total">
              <span>Valor Total</span>
              <span>{brl(sale.total)}</span>
            </div>
          </div>
        </div>

        {sale.notes && (
          <div className="doc-section">
            <div className="small muted bold">OBSERVAÇÕES</div>
            <div className="small">{sale.notes}</div>
          </div>
        )}

        <div className="signatures">
          <div className="sig-line">{company.tradeName || company.name}</div>
          <div className="sig-line">{sale.client?.name || "Assinatura do Cliente"}</div>
        </div>

        {company.receiptFooter && <div className="doc-footer">{company.receiptFooter}</div>}
      </div>
    </>
  );
}
