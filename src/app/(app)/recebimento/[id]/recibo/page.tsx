import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "@/lib/audit";
import { brl, fmtDateTime, num } from "@/lib/format";
import { PageHeader, StatusBadge } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { ensureStockLocationTables } from "@/lib/stock-location";

export default async function GoodsReceiptPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureStockLocationTables();

  const [receipt, company] = await Promise.all([
    prisma.goodsReceipt.findUnique({
      where: { id: Number(id) },
      include: {
        supplier: true,
        user: true,
        purchase: true,
        items: {
          include: {
            product: true,
            location: true,
          },
        },
      },
    }),
    getCompanySettings(),
  ]);

  if (!receipt) notFound();

  const totalQuantity = receipt.items.reduce((s, i) => s + i.quantity, 0);
  const totalCost = receipt.items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

  return (
    <>
      <PageHeader
        title={`Recebimento ${receipt.code}`}
        subtitle="Comprovante de conferência física e endereçamento de carga para impressão"
        actions={
          <>
            <Link className="btn secondary" href="/recebimento">
              <ArrowLeft size={15} /> Voltar aos Recebimentos
            </Link>
            <PrintButton label="Imprimir Comprovante" />
          </>
        }
      />

      <div className="print-doc">
        {/* Cabeçalho da Empresa */}
        <div className="doc-header">
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {company.logoUrl && (
              <img
                src={company.logoUrl}
                alt={company.tradeName || company.name}
                style={{ maxHeight: 60, maxWidth: 140, objectFit: "contain", borderRadius: 4 }}
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
            <h2>COMPROVANTE DE RECEBIMENTO</h2>
            <div className="small" style={{ fontWeight: 600, fontSize: 14 }}>{receipt.code}</div>
            <div className="small">Entrada: {fmtDateTime(receipt.receivedAt)}</div>
            {receipt.invoiceNumber && <div className="small">NF-e: {receipt.invoiceNumber}</div>}
            {receipt.purchaseId && <div className="small">Pedido de Compra: #{receipt.purchaseId}</div>}
            <div style={{ marginTop: 6 }}>
              <StatusBadge status={receipt.status} />
            </div>
          </div>
        </div>

        {/* Dados do Fornecedor e da Entrada */}
        <div className="doc-grid" style={{ marginTop: 14, marginBottom: 14 }}>
          <div>
            <div className="sub-title">DADOS DO FORNECEDOR / EMITENTE</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{receipt.supplier?.name || "Entrada Direta / Sem Fornecedor Cadastrado"}</div>
            {receipt.supplier?.document && <div className="small">CNPJ/CPF: {receipt.supplier.document}</div>}
            {receipt.supplier?.phone && <div className="small">Telefone: {receipt.supplier.phone}</div>}
            {receipt.supplier?.city && (
              <div className="small">
                {[receipt.supplier.address, receipt.supplier.city, receipt.supplier.state].filter(Boolean).join(" - ")}
              </div>
            )}
          </div>
          <div>
            <div className="sub-title">DADOS DA CONFERÊNCIA</div>
            <div className="small"><strong>Conferente:</strong> {receipt.user?.name || "Usuário do Sistema"}</div>
            <div className="small"><strong>Status da Carga:</strong> {receipt.status}</div>
            {receipt.notes && <div className="small"><strong>Obs:</strong> {receipt.notes}</div>}
          </div>
        </div>

        {/* Tabela dos Itens Recebidos e Endereçados */}
        <table className="doc-table" style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th style={{ width: "35%" }}>Produto / Matéria-Prima</th>
              <th style={{ width: "12%" }}>Lote / Ref</th>
              <th style={{ width: "25%" }}>Endereço no Estoque</th>
              <th style={{ width: "10%", textAlign: "right" }}>Qtd</th>
              <th style={{ width: "8%" }}>Un.</th>
              <th style={{ width: "10%", textAlign: "right" }}>Custo Unit.</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items.map((i) => (
              <tr key={i.id}>
                <td>
                  <strong>{i.product.name}</strong>
                  {i.product.sku && <span className="small muted"> (SKU: {i.product.sku})</span>}
                </td>
                <td>{i.batch || "—"}</td>
                <td>
                  {i.location ? (
                    <span>
                      <strong>{i.location.code}</strong>
                      <span className="small muted">
                        {" "}
                        {[i.location.aisle, i.location.rack, i.location.shelf, i.location.bin]
                          .filter(Boolean)
                          .join(" / ")}
                      </span>
                    </span>
                  ) : (
                    <span className="muted">Geral (sem endereço)</span>
                  )}
                </td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{num(i.quantity)}</td>
                <td>{i.product.unit}</td>
                <td style={{ textAlign: "right" }}>{brl(i.unitCost)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} style={{ fontWeight: 600 }}>Total de Itens Recebidos: {receipt.items.length}</td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>{num(totalQuantity)} un</td>
              <td></td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>{brl(totalCost)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Assinaturas */}
        <div className="doc-signatures" style={{ marginTop: 50, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30 }}>
          <div style={{ textAlign: "center", borderTop: "1px solid #71717a", paddingTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Responsável pelo Recebimento (Almoxarifado)</div>
            <div className="small muted">{receipt.user?.name || "Assinatura do Conferente"}</div>
          </div>
          <div style={{ textAlign: "center", borderTop: "1px solid #71717a", paddingTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Entregador / Transportadora</div>
            <div className="small muted">Nome e Documento (RG / CPF)</div>
          </div>
        </div>
      </div>
    </>
  );
}
