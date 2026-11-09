import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { brl, fmtDate, fmtDateTime, toInputDate, todayInput } from "@/lib/format";
import { FlashMessages, PageHeader, StatusBadge } from "@/components/ui";
import { ActionForm, ConfirmButton } from "@/components/Forms";
import { ItemsEditor } from "@/components/ItemsEditor";
import { cancelPurchase, deletePurchase, receivePurchase, savePurchase } from "../actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function CompraPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "novo";
  const purchase = isNew
    ? null
    : await prisma.purchase.findUnique({
        where: { id: Number(id) },
        include: { items: { include: { product: true } }, supplier: true, user: true, financial: true },
      });
  if (!isNew && !purchase) notFound();

  const editable = isNew || purchase!.status === "PENDENTE";

  const [suppliers, products] = await Promise.all([
    prisma.supplier.findMany({ where: { OR: [{ active: true }, { id: purchase?.supplierId ?? -1 }] }, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { OR: [{ active: true }, { id: { in: purchase?.items.map((i) => i.productId) ?? [] } }] },
      orderBy: { name: "asc" },
    }),
  ]);

  const editorProducts = products.map((p) => ({ id: p.id, sku: p.sku, name: p.name, unit: p.unit, price: p.costPrice, stock: p.stock }));
  const initialItems = purchase?.items.map((i) => ({ productId: i.productId, quantity: i.quantity, price: i.unitCost })) ?? [];

  return (
    <>
      <PageHeader
        title={isNew ? "Nova compra" : `Compra #${purchase!.id}`}
        subtitle={
          isNew
            ? "Registre o pedido de compra; o estoque entra quando a mercadoria for recebida"
            : `Criada em ${fmtDateTime(purchase!.createdAt)} por ${purchase!.user?.name ?? "—"}`
        }
        actions={
          purchase && (
            <>
              <StatusBadge status={purchase.status} />
              {purchase.status === "PENDENTE" && (
                <ConfirmButton
                  action={receivePurchase.bind(null, purchase.id)}
                  label="Receber mercadoria"
                  className="btn success"
                  confirmText="Confirmar o recebimento? Os itens serão somados ao estoque."
                />
              )}
              {purchase.status !== "CANCELADA" && (
                <ConfirmButton
                  action={cancelPurchase.bind(null, purchase.id)}
                  label="Cancelar compra"
                  className="btn warning"
                  confirmText="Cancelar esta compra? Se recebida, o estoque será estornado."
                />
              )}
              {purchase.status !== "RECEBIDA" && (
                <ConfirmButton
                  action={deletePurchase.bind(null, purchase.id)}
                  label="Excluir"
                  className="btn danger"
                  confirmText="Excluir definitivamente esta compra?"
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
            action={savePurchase.bind(null, purchase?.id ?? null)}
            submitLabel={isNew ? "Salvar pedido" : "Salvar alterações"}
            extraActions={
              <Link className="btn secondary" href="/compras">
                Voltar
              </Link>
            }
          >
            <div className="form-grid mb">
              <div className="field">
                <label>Fornecedor *</label>
                <select name="supplierId" defaultValue={purchase?.supplierId ?? ""} required>
                  <option value="" disabled>
                    Selecione...
                  </option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field s3">
                <label>Data do pedido</label>
                <input type="date" name="date" defaultValue={purchase ? toInputDate(purchase.date) : todayInput()} required />
              </div>
              <div className="field s3">
                <label>Vencimento do pagamento</label>
                <input type="date" name="dueDate" defaultValue={purchase ? toInputDate(purchase.dueDate) : ""} />
              </div>
            </div>

            <ItemsEditor products={editorProducts} initialItems={initialItems} priceLabel="Custo unit." />

            <div className="field s12 mt">
              <label>Observações</label>
              <textarea name="notes" defaultValue={purchase?.notes ?? ""} />
            </div>
          </ActionForm>
        </div>
      ) : (
        <div className="card">
          <dl className="dl mb">
            <dt>Fornecedor</dt>
            <dd>{purchase!.supplier ? <Link href={`/fornecedores/${purchase!.supplierId}`}>{purchase!.supplier.name}</Link> : "—"}</dd>
            <dt>Data do pedido</dt>
            <dd>{fmtDate(purchase!.date)}</dd>
            <dt>Vencimento</dt>
            <dd>{fmtDate(purchase!.dueDate)}</dd>
            <dt>Recebida em</dt>
            <dd>{fmtDateTime(purchase!.receivedAt)}</dd>
            {purchase!.notes && (
              <>
                <dt>Observações</dt>
                <dd>{purchase!.notes}</dd>
              </>
            )}
          </dl>
          <ItemsEditor products={editorProducts} initialItems={initialItems} priceLabel="Custo unit." readOnly />
        </div>
      )}

      {purchase && purchase.financial.length > 0 && (
        <div className="card flush">
          <div className="card-header">
            <h2>Contas a pagar vinculadas</h2>
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
              {purchase.financial.map((f) => (
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
    </>
  );
}
