import Link from "next/link";
import { ArrowLeft, Building2, FileText, PackageCheck, Truck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/Forms";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { createGoodsReceipt } from "../actions";
import { ReceiptItemsEditor, type ReceiptItemRow } from "../ReceiptItemsEditor";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function NovoRecebimentoPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const purchaseIdParam = sp.purchaseId ? Number(sp.purchaseId) : null;

  await ensureStockLocationTables();

  const [suppliers, products, locations, linkedPurchase] = await Promise.all([
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.stockLocation.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    purchaseIdParam
      ? prisma.purchase.findUnique({
          where: { id: purchaseIdParam },
          include: { items: { include: { product: true } }, supplier: true },
        })
      : null,
  ]);

  // Prepara itens iniciais caso tenha vindo de um Pedido de Compra
  const initialItems: ReceiptItemRow[] = linkedPurchase
    ? linkedPurchase.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitCost: i.unitCost,
        locationId: locations.length > 0 ? locations[0].id : null,
        batch: "",
        notes: "",
      }))
    : [];

  return (
    <>
      <PageHeader
        title="Novo Recebimento de Mercadorias & Matérias-Primas"
        subtitle={
          linkedPurchase
            ? `Recebimento vinculado ao Pedido de Compra #${linkedPurchase.id} (${linkedPurchase.supplier?.name || "Fornecedor"})`
            : "Conferência física, lançamento de NF-e e endereçamento no estoque"
        }
        actions={
          <Link className="btn secondary" href="/recebimento">
            <ArrowLeft size={16} /> Voltar para lista
          </Link>
        }
      />

      <div className="card">
        <ActionForm action={createGoodsReceipt.bind(null)}>
          {linkedPurchase && <input type="hidden" name="purchaseId" value={linkedPurchase.id} />}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Fornecedor
              </label>
              <select name="supplierId" defaultValue={linkedPurchase?.supplierId || ""}>
                <option value="">(Entrada Direta / Fornecedor Avulso)</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.document ? `(${s.document})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Número da Nota Fiscal (NF-e)
              </label>
              <input
                type="text"
                name="invoiceNumber"
                placeholder="Ex: 0012489 ou S/N"
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Observações / Conhecimento / Transportadora
              </label>
              <input
                type="text"
                name="notes"
                defaultValue={linkedPurchase ? `Vinculado à Compra #${linkedPurchase.id}` : ""}
                placeholder="Ex: Entregue por Rodonaves, volumes lacrados"
              />
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 18, marginBottom: 20 }}>
            <div style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Itens e Insumos Recebidos</h3>
              <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "2px 0 0" }}>
                Especifique a quantidade e o <strong>endereço de estoque</strong> onde cada item está sendo guardado. O saldo do produto e a quantidade naquele endereço serão aumentados automaticamente.
              </p>
            </div>

            <ReceiptItemsEditor
              products={products.map((p) => ({
                id: p.id,
                sku: p.sku,
                name: p.name,
                unit: p.unit,
                costPrice: p.costPrice,
                stock: p.stock,
              }))}
              locations={locations}
              initialItems={initialItems}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <Link className="btn ghost" href="/recebimento">
              Cancelar
            </Link>
            <button type="submit" className="btn">
              <PackageCheck size={16} /> Confirmar Entrada no Estoque
            </button>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
