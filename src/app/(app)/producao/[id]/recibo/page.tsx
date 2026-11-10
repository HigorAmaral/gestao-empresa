import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Factory, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "@/lib/audit";
import { fmtDate, fmtDateTime, num } from "@/lib/format";
import { PageHeader, StatusBadge } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { ensureStockLocationTables } from "@/lib/stock-location";

export default async function ProductionOrderPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureStockLocationTables();

  const [order, company] = await Promise.all([
    prisma.productionOrder.findUnique({
      where: { id: Number(id) },
      include: {
        product: true,
        user: true,
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

  if (!order) notFound();

  return (
    <>
      <PageHeader
        title={`Ficha de Produção & Entrega na Máquina — ${order.code}`}
        subtitle="Documento pronto para impressão em folha A4 para acompanhar os materiais até a máquina"
        actions={
          <>
            <Link className="btn secondary" href={`/producao/${order.id}`}>
              <ArrowLeft size={15} /> Voltar à OP
            </Link>
            <PrintButton label="Imprimir Ficha da Máquina" />
          </>
        }
      />

      <div className="print-doc">
        {/* Cabeçalho da Empresa */}
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
            <h2>FICHA DE ORDEM DE PRODUÇÃO</h2>
            <div className="small" style={{ fontWeight: 700, fontSize: 16 }}>{order.code}</div>
            <div className="small">Emissão: {fmtDateTime(order.createdAt)}</div>
            {order.deliveryDate && <div className="small">Previsão Entrega: {fmtDate(order.deliveryDate)}</div>}
            <div style={{ marginTop: 6 }}>
              <StatusBadge status={order.status} />
            </div>
          </div>
        </div>

        {/* Banner de Destaque da Máquina de Destino */}
        <div
          style={{
            border: "2px solid #09090b",
            borderRadius: 6,
            padding: "12px 16px",
            marginTop: 14,
            marginBottom: 14,
            display: "grid",
            gridTemplateColumns: "2fr 1.5fr 1fr",
            gap: 12,
            background: "#fafafa",
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#52525b" }}>
              MÁQUINA / POSTO DE ENTREGA
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2, color: "#09090b" }}>
              {order.machine}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#52525b" }}>
              OPERADOR DESIGNADO
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>
              {order.operatorName || "A definir na produção"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#52525b" }}>
              PRIORIDADE
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>
              {order.priority}
            </div>
          </div>
        </div>

        {/* Produto Acabado a Fabricar */}
        <div className="doc-grid" style={{ marginBottom: 14 }}>
          <div>
            <div className="sub-title">PRODUTO A SER FABRICADO</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{order.product.name}</div>
            {order.product.sku && <div className="small">SKU / Código: {order.product.sku}</div>}
            <div className="small">Categoria: {order.product.category || "Geral"}</div>
          </div>
          <div>
            <div className="sub-title">QUANTIDADE PLANEJADA</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              {num(order.quantity)} {order.product.unit}
            </div>
            <div className="small muted">Responsável pela abertura: {order.user?.name || "Sistema"}</div>
          </div>
        </div>

        {/* Tabela de Insumos / Lista de Separação (Picking List) */}
        <div style={{ marginTop: 14 }}>
          <div className="sub-title" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
            LISTA DE MATÉRIAS-PRIMAS PARA RETIRADA NO ESTOQUE E ENTREGA NA MÁQUINA
          </div>
          <table className="doc-table">
            <thead>
              <tr>
                <th style={{ width: "6%", textAlign: "center" }}>OK</th>
                <th style={{ width: "34%" }}>Insumo / Matéria-Prima</th>
                <th style={{ width: "14%", textAlign: "right" }}>Qtd Necessária</th>
                <th style={{ width: "28%" }}>Localização no Estoque</th>
                <th style={{ width: "18%" }}>Observações / Instruções</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((i) => (
                <tr key={i.id}>
                  <td style={{ textAlign: "center", fontSize: 16 }}>
                    <span style={{ display: "inline-block", width: 14, height: 14, border: "1.5px solid #09090b", borderRadius: 2 }}></span>
                  </td>
                  <td>
                    <strong>{i.product.name}</strong>
                    {i.product.sku && <span className="small muted"> ({i.product.sku})</span>}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>
                    {num(i.quantityRequired)} {i.product.unit}
                  </td>
                  <td>
                    {i.location ? (
                      <div>
                        <strong>{i.location.code}</strong>
                        <div className="small muted">
                          {[i.location.aisle, i.location.rack, i.location.shelf, i.location.bin]
                            .filter(Boolean)
                            .join(" / ")}
                        </div>
                      </div>
                    ) : (
                      <span className="muted">Estoque Geral (sem endereço)</span>
                    )}
                  </td>
                  <td>{i.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} style={{ fontWeight: 700 }}>Total de Itens Requisitados: {order.items.length}</td>
                <td colSpan={3} style={{ fontSize: 11, color: "#52525b" }}>
                  Favor conferir cada insumo no ato da entrega na máquina.
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Instruções Técnicas da OP */}
        {order.notes && (
          <div style={{ marginTop: 14, padding: "8px 12px", border: "1px solid #d4d4d8", borderRadius: 4, background: "#fafafa" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>
              INSTRUÇÕES TÉCNICAS DE FABRICAÇÃO:
            </div>
            <div style={{ fontSize: 12 }}>{order.notes}</div>
          </div>
        )}

        {/* Assinaturas de Separação e Entrega na Máquina */}
        <div className="doc-signatures" style={{ marginTop: 45, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30 }}>
          <div style={{ textAlign: "center", borderTop: "1px solid #71717a", paddingTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Almoxarifado (Separação & Transporte)</div>
            <div className="small muted">Data: ____/____/________ • Assinatura: ___________________________</div>
          </div>
          <div style={{ textAlign: "center", borderTop: "1px solid #71717a", paddingTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Operador da Máquina (Recebimento dos Insumos)</div>
            <div className="small muted">Data: ____/____/________ • Assinatura: ___________________________</div>
          </div>
        </div>
      </div>
    </>
  );
}
