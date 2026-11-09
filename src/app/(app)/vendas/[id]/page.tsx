import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { brl, fmtDate, fmtDateTime, PAYMENT_METHODS, toInputDate, todayInput } from "@/lib/format";
import { FlashMessages, PageHeader, StatusBadge } from "@/components/ui";
import { ActionForm, ConfirmButton } from "@/components/Forms";
import { ItemsEditor } from "@/components/ItemsEditor";
import { cancelSale, confirmSale, deleteSale, saveSale } from "../actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function VendaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "novo";
  const sale = isNew
    ? null
    : await prisma.sale.findUnique({
        where: { id: Number(id) },
        include: { items: { include: { product: true } }, client: true, user: true, financial: true },
      });
  if (!isNew && !sale) notFound();

  const editable = isNew || sale!.status === "ORCAMENTO";

  const [clients, products] = await Promise.all([
    prisma.client.findMany({ where: { OR: [{ active: true }, { id: sale?.clientId ?? -1 }] }, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { OR: [{ active: true }, { id: { in: sale?.items.map((i) => i.productId) ?? [] } }] },
      orderBy: { name: "asc" },
    }),
  ]);

  const editorProducts = products.map((p) => ({ id: p.id, sku: p.sku, name: p.name, unit: p.unit, price: p.salePrice, stock: p.stock }));
  const initialItems = sale?.items.map((i) => ({ productId: i.productId, quantity: i.quantity, price: i.unitPrice })) ?? [];

  return (
    <>
      <PageHeader
        title={isNew ? "Nova venda" : `Venda #${sale!.id}`}
        subtitle={
          isNew ? "Monte o orçamento e confirme para efetivar a venda" : `Criada em ${fmtDateTime(sale!.createdAt)} por ${sale!.user?.name ?? "—"}`
        }
        actions={
          sale && (
            <>
              <StatusBadge status={sale.status} />
              <Link className="btn secondary" href={`/vendas/${sale.id}/recibo`}>
                <Printer size={15} /> Recibo / Pedido
              </Link>
              {sale.status === "ORCAMENTO" && (
                <ConfirmButton
                  action={confirmSale.bind(null, sale.id)}
                  label="Confirmar venda"
                  className="btn success"
                  confirmText="Confirmar a venda? O estoque será baixado e uma conta a receber será criada."
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
              <div className="field">
                <label>Cliente</label>
                <select name="clientId" defaultValue={sale?.clientId ?? ""}>
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
              <dd>{sale!.client ? <Link href={`/clientes/${sale!.clientId}`}>{sale!.client.name}</Link> : "Consumidor final"}</dd>
              <dt>Data</dt>
              <dd>{fmtDate(sale!.date)}</dd>
              <dt>Forma de pagamento</dt>
              <dd>{sale!.paymentMethod ?? "—"}</dd>
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
                <h2>Lançamentos financeiros</h2>
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
