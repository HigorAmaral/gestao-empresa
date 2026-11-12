import { notFound } from "next/navigation";
import { Building2, CheckCircle2, Phone, ShieldCheck, Wrench } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "@/lib/audit";
import { spStr } from "@/lib/form";
import { brl, fmtDate, fmtDateTime } from "@/lib/format";
import { verifyPublicToken } from "@/lib/public-token";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { PrintButton } from "@/components/PrintButton";
import { StatusBadge } from "@/components/ui";
import { PixQrBox } from "@/components/PixQrBox";
import { approvePublicOsAction } from "../../actions";

type Params = Promise<{ id: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function PublicOsApprovalPage({
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

  const osId = Number(id);
  if (!osId || !verifyPublicToken("os", osId, token)) {
    notFound();
  }

  const [os, company] = await Promise.all([
    prisma.serviceOrder.findUnique({
      where: { id: osId },
      include: {
        client: true,
        technician: true,
        items: { include: { product: true } },
      },
    }),
    getCompanySettings(),
  ]);

  if (!os) notFound();

  const isApproved = Boolean(os.approvedAt) || os.status === "CONCLUIDA";
  const boundApprove = approvePublicOsAction.bind(null, os.id, token);

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
            <CheckCircle2 size={16} className="icon-inline" /> Ordem de Serviço autorizada/aprovada com sucesso! Nossa equipe técnica já foi notificada.
          </div>
        )}
        {erro && <div className="alert error mb">{erro}</div>}

        <div className="card mb">
          <div className="card-header" style={{ flexWrap: "wrap" }}>
            <h2>
              <Wrench size={18} /> Acompanhamento de Ordem de Serviço #{os.id}
            </h2>
            <div className="row" style={{ gap: 8 }}>
              <StatusBadge status={os.status} />
              {os.approvedAt && (
                <span className="badge success">
                  <ShieldCheck size={13} /> Autorizada em {fmtDateTime(os.approvedAt)}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-2 mb" style={{ gap: 14 }}>
            <div style={{ padding: 12, borderRadius: 8, background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
              <div className="small muted bold">EQUIPAMENTO & CLIENTE</div>
              <div className="bold" style={{ marginTop: 4 }}>{os.equipment}</div>
              {os.serialNumber && <div className="small muted">Nº de Série: {os.serialNumber}</div>}
              <div className="small" style={{ marginTop: 6 }}>
                <strong>Cliente:</strong> {os.client?.name ?? "Consumidor Final"}
              </div>
            </div>
            <div style={{ padding: 12, borderRadius: 8, background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
              <div className="small muted bold">DATAS & RESPONSÁVEL</div>
              <div className="small" style={{ marginTop: 4 }}>
                <strong>Abertura:</strong> {fmtDateTime(os.openedAt)}
              </div>
              <div className="small">
                <strong>Previsão:</strong> {os.expectedDate ? fmtDate(os.expectedDate) : "A definir"}
              </div>
              <div className="small">
                <strong>Técnico:</strong> {os.technician?.name ?? "Equipe Técnica"}
              </div>
            </div>
          </div>

          <div className="mb" style={{ padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
            <div className="small muted bold">DEFEITO / SOLICITAÇÃO RELATADA</div>
            <div style={{ marginTop: 4 }}>{os.reportedIssue}</div>
            {os.diagnosis && (
              <>
                <div className="small muted bold" style={{ marginTop: 12 }}>DIAGNÓSTICO / LAUDO TÉCNICO</div>
                <div style={{ marginTop: 4 }}>{os.diagnosis}</div>
              </>
            )}
          </div>

          {os.items.length > 0 && (
            <div className="table-wrap mb">
              <table>
                <thead>
                  <tr>
                    <th>Peça / Componente</th>
                    <th className="num">Qtd</th>
                    <th className="num">Valor Un.</th>
                    <th className="num">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {os.items.map((item) => (
                    <tr key={item.id}>
                      <td className="bold">{item.product.name}</td>
                      <td className="num">
                        {item.quantity} {item.product.unit}
                      </td>
                      <td className="num">{brl(item.unitPrice)}</td>
                      <td className="num bold">{brl(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="row between" style={{ padding: "12px 14px", borderRadius: 8, background: "var(--surface-subtle)", border: "1px solid var(--border)", flexWrap: "wrap", gap: 12 }}>
            <div className="small">
              Peças: <strong>{brl(os.partsSubtotal)}</strong> • Mão de Obra: <strong>{brl(os.laborCost)}</strong>
              {os.discount > 0 ? ` • Desconto: -${brl(os.discount)}` : ""}
            </div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>TOTAL DA OS: {brl(os.total)}</div>
          </div>

          {company.pixKey && os.total > 0 && (
            <div style={{ marginTop: 16 }}>
              <PixQrBox
                pixKey={company.pixKey}
                merchantName={company.tradeName || company.name}
                merchantCity={company.city || "SAO PAULO"}
                amount={os.total}
                txid={`OS${os.id}`}
              />
            </div>
          )}
        </div>

        {!isApproved && os.status !== "CANCELADA" && (
          <div className="card no-print" style={{ border: "2px solid var(--primary)" }}>
            <div className="card-header">
              <h2>
                <CheckCircle2 size={18} /> Autorizar / Aprovar Orçamento da OS
              </h2>
            </div>
            <p className="small muted mb">
              Ao clicar no botão abaixo, você autoriza a execução do serviço e peças descritas acima pelo valor total de{" "}
              <strong>{brl(os.total)}</strong>.
            </p>
            <form action={boundApprove}>
              <div className="field mb">
                <label>Observação opcional para o técnico</label>
                <input name="clientNotes" placeholder="Ex: Pode prosseguir com o reparo..." />
              </div>
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <button type="submit" className="btn" style={{ padding: "12px 22px", fontSize: 14.5 }}>
                  <CheckCircle2 size={17} /> Autorizar Execução da OS ({brl(os.total)})
                </button>
                {company.phone && (
                  <a
                    className="btn secondary"
                    href={`https://wa.me/55${company.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Estou visualizando a OS #${os.id} (${os.equipment}) e gostaria de falar sobre o orçamento.`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Phone size={15} /> Falar no WhatsApp
                  </a>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
