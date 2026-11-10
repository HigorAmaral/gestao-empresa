import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileCheck, FileText, MessageCircle, Printer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { brl, fmtDate, fmtDateTime, PAYMENT_METHODS, toInputDate, todayInput } from "@/lib/format";
import { buildWhatsAppUrl, saleWhatsAppMessage } from "@/lib/whatsapp";
import { FlashMessages, PageHeader, StatusBadge } from "@/components/ui";
import { ActionForm, ConfirmButton } from "@/components/Forms";
import { ItemsEditor } from "@/components/ItemsEditor";
import { cancelSale, confirmSale, deleteSale, duplicateSale, saveSale } from "../actions";
import { emitNfeFromSale } from "@/app/(app)/nfe/actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function VendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SP;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "novo";
  const sale = isNew
    ? null
    : await prisma.sale.findUnique({
        where: { id: Number(id) },
        include: {
          items: { include: { product: true } },
          client: true,
          user: true,
          financial: true,
          invoices: { orderBy: { id: "desc" } },
        },
      });
  if (!isNew && !sale) notFound();

  const editable = isNew || sale!.status === "ORCAMENTO";
  const defaultClientId = typeof sp.clientId === "string" ? Number(sp.clientId) : sale?.clientId ?? "";

  const [clients, products] = await Promise.all([
    prisma.client.findMany({
      where: { OR: [{ active: true }, { id: sale?.clientId ?? -1 }] },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { OR: [{ active: true }, { id: { in: sale?.items.map((i) => i.productId) ?? [] } }] },
      orderBy: { name: "asc" },
    }),
  ]);

  const editorProducts = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    unit: p.unit,
    price: p.salePrice,
    stock: p.stock,
  }));
  const initialItems =
    sale?.items.map((i) => ({ productId: i.productId, quantity: i.quantity, price: i.unitPrice })) ?? [];

  const waUrl = sale
    ? buildWhatsAppUrl(
        sale.client?.phone,
        saleWhatsAppMessage({
          id: sale.id,
          status: sale.status,
          date: sale.date,
          total: sale.total,
          paymentMethod: sale.paymentMethod,
          installments: sale.installments,
          clientName: sale.client?.name,
          items: sale.items.map((i) => ({
            name: i.product.name,
            quantity: i.quantity,
            total: i.total,
          })),
        }),
      )
    : null;

  return (
    <>
      <PageHeader
        title={isNew ? "Nova venda" : `Venda #${sale!.id}`}
        subtitle={
          isNew
            ? "Monte o orçamento, escolha o parcelamento e confirme para efetivar a venda"
            : `Criada em ${fmtDateTime(sale!.createdAt)} por ${sale!.user?.name ?? "—"}`
        }
        actions={
          sale && (
            <>
              <StatusBadge status={sale.status} />
              {waUrl && (
                <a className="btn secondary" href={waUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={15} /> WhatsApp
                </a>
              )}
              <Link className="btn secondary" href={`/vendas/${sale.id}/recibo`}>
                <Printer size={15} /> Recibo / Pedido
              </Link>
              {sale.invoices && sale.invoices.length > 0 ? (
                <Link className="btn secondary" href={`/nfe/${sale.invoices[0].id}`}>
                  <FileCheck size={15} /> NF-e #{sale.invoices[0].number}
                </Link>
              ) : (
                sale.status === "CONFIRMADA" && (
                  <ConfirmButton
                    action={emitNfeFromSale.bind(null, sale.id)}
                    label="Emitir NF-e"
                    className="btn"
                    confirmText={`Emitir Nota Fiscal Eletrônica (NF-e) para a Venda #${sale.id}?`}
                  />
                )
              )}
              <form action={duplicateSale.bind(null, sale.id)} className="inline-form">
                <button type="submit" className="btn secondary" title="Criar novo orçamento com os mesmos itens">
                  Duplicar Pedido
                </button>
              </form>
              {sale.status === "ORCAMENTO" && (
                <ConfirmButton
                  action={confirmSale.bind(null, sale.id)}
                  label="Confirmar venda"
                  className="btn success"
                  confirmText="Confirmar a venda? O estoque será baixado e as parcelas serão geradas no financeiro."
                />
              )}
              {sale.status !== "CANCELADA" && (
                <ConfirmButton
                  action={cancelSale.bind(null, sale.id)}
                  label="Cancelar venda"
                  className="btn warning"
                  confirmText="Cancelar esta venda? Se confirmada, o estoque será devolvido."
                />
              )}
              {sale.status !== "CONFIRMADA" && (
                <ConfirmButton
                  action={deleteSale.bind(null, sale.id)}
                  label="Excluir"
                  className="btn danger"
                  confirmText="Excluir definitivamente esta venda?"
                />
              )}
            </>
          )
        }
      />
      <FlashMessages sp={sp} />

      {sale && sale.invoices && sale.invoices.length > 0 && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: "#166534", fontSize: 14 }}>
              ✓ Nota Fiscal Eletrônica (NF-e nº {sale.invoices[0].number}) Emitida
            </div>
            {sale.invoices[0].accessKey && (
              <div style={{ fontSize: 12, fontFamily: "monospace", color: "#15803d", marginTop: 2 }}>
                Chave SEFAZ: {sale.invoices[0].accessKey}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href={`/nfe/${sale.invoices[0].id}/danfe`} className="btn secondary" style={{ fontSize: 12.5 }}>
              <Printer size={14} /> Imprimir DANFE
            </Link>
            <a
              href={`/nfe/${sale.invoices[0].id}/xml`}
              download={`NFe-${sale.invoices[0].accessKey || sale.invoices[0].number}.xml`}
              className="btn secondary"
              style={{ fontSize: 12.5 }}
            >
              <Download size={14} /> Baixar XML
            </a>
            <Link href={`/nfe/${sale.invoices[0].id}`} className="btn secondary" style={{ fontSize: 12.5 }}>
              Ver Detalhes da NF-e →
            </Link>
          </div>
        </div>
      )}

      {editable ? (
        <div className="card">
          <ActionForm
            action={saveSale.bind(null, sale?.id ?? null)}
            submitLabel={isNew ? "Salvar orçamento" : "Salvar alterações"}
            extraActions={
              <Link className="btn secondary" href="/vendas">
                Voltar
              </Link>
            }
          >
            <div className="form-grid mb">
              <div className="field s4">
                <label>Cliente</label>
                <select name="clientId" defaultValue={defaultClientId}>
                  <option value="">Consumidor final</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field s3">
                <label>Data</label>
                <input type="date" name="date" defaultValue={sale ? toInputDate(sale.date) : todayInput()} required />
              </div>
              <div className="field s3">
                <label>Forma de pagamento</label>
                <select name="paymentMethod" defaultValue={sale?.paymentMethod ?? ""}>
                  <option value="">—</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="field s2">
                <label>Parcelas</label>
                <select name="installments" defaultValue={sale?.installments ?? 1}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? "1x (À vista)" : `${n}x mensais`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <ItemsEditor
              products={editorProducts}
              initialItems={initialItems}
              initialDiscount={sale?.discount ?? 0}
              showDiscount
              checkStock
            />

            <div className="field s12 mt">
              <label>Observações</label>
              <textarea name="notes" defaultValue={sale?.notes ?? ""} />
            </div>
          </ActionForm>
        </div>
      ) : (
        <>
          <div className="card">
            <dl className="dl mb">
              <dt>Cliente</dt>
              <dd>
                {sale!.client ? (
                  <Link href={`/clientes/${sale!.clientId}`}>{sale!.client.name}</Link>
                ) : (
                  "Consumidor final"
                )}
              </dd>
              <dt>Data</dt>
              <dd>{fmtDate(sale!.date)}</dd>
              <dt>Forma de pagamento</dt>
              <dd>
                {sale!.paymentMethod ?? "—"}{" "}
                {sale!.installments > 1 && <span className="badge blue">{sale!.installments}x</span>}
              </dd>
              {sale!.notes && (
                <>
                  <dt>Observações</dt>
                  <dd>{sale!.notes}</dd>
                </>
              )}
            </dl>
            <ItemsEditor
              products={editorProducts}
              initialItems={initialItems}
              initialDiscount={sale!.discount}
              showDiscount
              readOnly
            />
          </div>

          {sale!.financial.length > 0 && (
            <div className="card flush">
              <div className="card-header">
                <h2>Lançamentos financeiros ({sale!.financial.length} parcela(s))</h2>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Vencimento</th>
                    <th>Status</th>
                    <th className="num">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {sale!.financial.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <Link href={`/financeiro/${f.id}`}>{f.description}</Link>
                      </td>
                      <td>{fmtDate(f.dueDate)}</td>
                      <td>
                        <StatusBadge status={f.status} />
                      </td>
                      <td className="num">{brl(f.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="form-actions">
            <Link className="btn secondary" href="/vendas">
              Voltar
            </Link>
          </div>
        </>
      )}
    </>
  );
}
