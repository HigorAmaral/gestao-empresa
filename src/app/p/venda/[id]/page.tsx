import { notFound } from "next/navigation";
import { Building2, CheckCircle2, FileText, Phone, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "@/lib/audit";
import { spStr } from "@/lib/form";
import { brl, fmtDate, fmtDateTime } from "@/lib/format";
import { verifyPublicToken } from "@/lib/public-token";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { PixQrBox } from "@/components/PixQrBox";
import { PrintButton } from "@/components/PrintButton";
import { StatusBadge } from "@/components/ui";
import { approvePublicSaleAction } from "../../actions";

type Params = Promise<{ id: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function PublicSaleApprovalPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SP;
}) {
  await ensureStockLocationTables();
  const { id } = await params;
  const sp = await searchParams;
  const token = spStr(sp, "t");
  const ok = spStr(sp, "ok");
  const erro = spStr(sp, "erro");

  const saleId = Number(id);
  if (!saleId || !verifyPublicToken("venda", saleId, token)) {
    notFound();
  }

  const [sale, company] = await Promise.all([
    prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        client: true,
        user: true,
        items: { include: { product: true } },
      },
    }),
    getCompanySettings(),
  ]);

  if (!sale) notFound();

  const isApproved = sale.status === "CONFIRMADA" || Boolean(sale.approvedAt);
  const boundApprove = approvePublicSaleAction.bind(null, sale.id, token);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "28px 16px 60px" }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        {/* Cabeçalho da Empresa */}
        <div className="card mb">
          <div className="row between" style={{ flexWrap: "wrap", gap: 16 }}>
            <div className="row" style={{ gap: 14 }}>
              {company.logoUrl ? (
                <img
                  src={company.logoUrl}
                  alt={company.tradeName || company.name}
                  style={{ width: 52, height: 52, borderRadius: 10, objectFit: "contain", border: "1px solid var(--border)", padding: 4, background: "#fff" }}
                />
              ) : (
                <div className="logo" style={{ width: 48, height: 48 }}>
                  <Building2 size={24} />
                </div>
              )}
              <div>
                <h1 style={{ fontSize: 20 }}>{company.tradeName || company.name}</h1>
                <div className="small muted">
                  CNPJ: {company.document || "—"} • {company.phone || ""} • {company.city || ""}/{company.state || ""}
                </div>
              </div>
            </div>
            <div className="row no-print" style={{ gap: 8 }}>
              <PrintButton label="Imprimir / Salvar PDF" />
            </div>
          </div>
        </div>

        {ok && (
          <div className="alert success mb">
            <CheckCircle2 size={16} className="icon-inline" /> Proposta / Orçamento aprovado com sucesso! Nossa equipe já foi notificada.
          </div>
        )}
        {erro && <div className="alert error mb">{erro}</div>}

        {/* Detalhes da Proposta / Pedido */}
        <div className="card mb">
          <div className="card-header" style={{ flexWrap: "wrap" }}>
            <h2>
              <FileText size={18} />{" "}
              {sale.status === "ORCAMENTO" ? `Proposta Comercial / Orçamento #${sale.id}` : `Pedido de Venda #${sale.id}`}
            </h2>
            <div className="row" style={{ gap: 8 }}>
              <StatusBadge status={sale.status} />
              {sale.approvedAt && (
                <span className="badge success">
                  <ShieldCheck size={13} /> Aprovado pelo Cliente em {fmtDateTime(sale.approvedAt)}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-2 mb" style={{ gap: 14 }}>
            <div style={{ padding: 12, borderRadius: 8, background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
              <div className="small muted bold">DADOS DO CLIENTE</div>
              <div className="bold" style={{ marginTop: 4 }}>{sale.client?.name ?? "Consumidor Final"}</div>
              {sale.client?.document && <div className="small muted">CPF/CNPJ: {sale.client.document}</div>}
              {sale.client?.phone && <div className="small muted">Tel: {sale.client.phone}</div>}
            </div>
            <div style={{ padding: 12, borderRadius: 8, background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
              <div className="small muted bold">CONDIÇÕES COMERCIAIS</div>
              <div className="small" style={{ marginTop: 4 }}>
                <strong>Data de Emissão:</strong> {fmtDate(sale.date)}
              </div>
              <div className="small">
                <strong>Forma de Pagamento:</strong> {sale.paymentMethod || "A combinar"}{" "}
                {sale.installments > 1 ? `(${sale.installments}x)` : ""}
              </div>
              <div className="small">
                <strong>Vendedor Responsável:</strong> {sale.user?.name || "Atendimento Comercial"}
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descrição do Produto / Item</th>
                  <th className="num">Qtd</th>
                  <th className="num">Preço Un.</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item) => (
                  <tr key={item.id}>
                    <td className="small muted">{item.product.sku}</td>
                    <td className="bold">{item.product.name}</td>
                    <td className="num">
                      {item.quantity} {item.product.unit}
                    </td>
                    <td className="num">{brl(item.unitPrice)}</td>
                    <td className="num bold">{brl(item.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="num">Subtotal</td>
                  <td className="num">{brl(sale.subtotal)}</td>
                </tr>
                {sale.discount > 0 && (
                  <tr>
                    <td colSpan={4} className="num">Desconto Concedido</td>
                    <td className="num">-{brl(sale.discount)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={4} className="num" style={{ fontSize: 15 }}>VALOR TOTAL DA PROPOSTA</td>
                  <td className="num" style={{ fontSize: 16 }}>{brl(sale.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {sale.notes && (
            <div className="mt small muted">
              <strong>Observações:</strong> {sale.notes}
            </div>
          )}
          {sale.clientNotes && (
            <div className="mt small">
              <strong>Observação do Cliente na Aprovação:</strong> {sale.clientNotes}
            </div>
          )}
        </div>

        {/* Área de Aprovação Online pelo Cliente */}
        {!isApproved && sale.status === "ORCAMENTO" ? (
          <div className="card no-print" style={{ border: "2px solid var(--primary)" }}>
            <div className="card-header">
              <h2>
                <CheckCircle2 size={18} /> Aprovar Orçamento Online
              </h2>
            </div>
            <p className="small muted mb">
              Confira os itens e valores acima. Ao clicar em <strong>Aprovar Orçamento Agora</strong>, seu pedido será
              confirmado imediatamente em nosso sistema.
            </p>
            <form action={boundApprove}>
              <div className="field mb">
                <label>Observação opcional (ex.: horário de entrega, dados adicionais)</label>
                <input
                  name="clientNotes"
                  placeholder="Opcional: deixe uma mensagem para o vendedor..."
                />
              </div>
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <button type="submit" className="btn" style={{ padding: "12px 22px", fontSize: 14.5 }}>
                  <CheckCircle2 size={17} /> Aprovar Orçamento Agora ({brl(sale.total)})
                </button>
                {company.phone && (
                  <a
                    className="btn secondary"
                    href={`https://wa.me/55${company.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Estou visualizando o Orçamento #${sale.id} no valor de ${brl(sale.total)} e gostaria de tirar uma dúvida.`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Phone size={15} /> Falar com Vendedor no WhatsApp
                  </a>
                )}
              </div>
            </form>
          </div>
        ) : (
          <div className="card">
            <div className="row between" style={{ flexWrap: "wrap", gap: 16 }}>
              <div>
                <h2 style={{ marginBottom: 6 }}>
                  <CheckCircle2 size={18} /> Proposta Confirmada
                </h2>
                <p className="small muted" style={{ margin: 0 }}>
                  {company.receiptFooter || "Obrigado pela preferência!"}
                </p>
              </div>
              {company.pixKey && sale.total > 0 && (
                <PixQrBox
                  pixKey={company.pixKey}
                  merchantName={company.tradeName || company.name}
                  merchantCity={company.city || "SAO PAULO"}
                  amount={sale.total}
                  txid={`VENDA${sale.id}`}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
