import Link from "next/link";
import { ArrowLeft, Factory, Wrench } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/Forms";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { createProductionOrder } from "../actions";
import { ProductionItemsEditor, type ProductionProduct } from "../ProductionItemsEditor";

export default async function NovaProducaoPage() {
  await ensureStockLocationTables();

  const [products, locations] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: {
        stockLocations: {
          include: { location: true },
        },
      },
    }),
    prisma.stockLocation.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
  ]);

  const productionProducts: ProductionProduct[] = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    unit: p.unit,
    stock: p.stock,
    locations: p.stockLocations.map((sl) => ({
      locationId: sl.locationId,
      code: sl.location.code,
      quantity: sl.quantity,
      description: sl.location.description,
    })),
  }));

  return (
    <>
      <PageHeader
        title="Nova Ordem de Produção (OP)"
        subtitle="Defina o produto acabado, a máquina de destino e a lista de matérias-primas necessárias"
        actions={
          <Link className="btn secondary" href="/producao">
            <ArrowLeft size={16} /> Voltar para lista
          </Link>
        }
      />

      <div className="card">
        <ActionForm action={createProductionOrder.bind(null)}>
          {/* Seção 1: Dados do Produto a Fabricar e Máquina */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 20 }}>
            <div style={{ gridColumn: "span 2" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Produto Acabado a Fabricar *
              </label>
              <select name="productId" required defaultValue="">
                <option value="">Selecione o produto final que será produzido...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku ? `[${p.sku}] ` : ""}
                    {p.name} (Saldo atual: {p.stock} {p.unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Quantidade Planejada *
              </label>
              <input
                type="number"
                name="quantity"
                min="0.01"
                step="any"
                placeholder="Ex: 50"
                required
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Máquina / Posto de Entrega *
              </label>
              <input
                type="text"
                name="machine"
                list="machine-suggestions"
                placeholder="Ex: Torno CNC 01, Bancada 02"
                required
              />
              <datalist id="machine-suggestions">
                <option value="Torno CNC 01" />
                <option value="Torno CNC 02" />
                <option value="Centro de Usinagem 01" />
                <option value="Injetora 01" />
                <option value="Injetora 02" />
                <option value="Prensa Hidráulica 01" />
                <option value="Bancada de Montagem 01" />
                <option value="Bancada de Montagem 02" />
                <option value="Linha de Solda 01" />
                <option value="Cabine de Pintura" />
              </datalist>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Operador Responsável
              </label>
              <input
                type="text"
                name="operatorName"
                placeholder="Ex: Carlos Oliveira"
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Prioridade da OP
              </label>
              <select name="priority" defaultValue="NORMAL">
                <option value="BAIXA">Baixa</option>
                <option value="NORMAL">Normal</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Previsão de Entrega na Máquina
              </label>
              <input type="date" name="deliveryDate" />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Instruções Técnicas e Operacionais
              </label>
              <textarea
                name="notes"
                rows={2}
                placeholder="Instruções para o operador da máquina, desenho técnico de referência, tolerâncias ou cuidados especiais..."
              />
            </div>
          </div>

          {/* Seção 2: Lista de Insumos e Separação (BOM) */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 18, marginBottom: 20 }}>
            <div style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                Lista de Insumos & Matérias-Primas Necessárias (BOM)
              </h3>
              <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "2px 0 0" }}>
                Relacione todos os materiais que devem ser separados no estoque e entregues na máquina para realizar a fabricação.
              </p>
            </div>

            <ProductionItemsEditor
              products={productionProducts}
              locations={locations}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <Link className="btn ghost" href="/producao">
              Cancelar
            </Link>
            <button type="submit" className="btn">
              <Factory size={16} /> Gerar Ordem de Produção
            </button>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
