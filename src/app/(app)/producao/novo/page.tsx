import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { ProductionOrderForm } from "../ProductionOrderForm";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function NovaProducaoPage({ searchParams }: { searchParams?: SP }) {
  await ensureStockLocationTables();

  const sp = searchParams ? await searchParams : {};
  const defaultMachine = typeof sp?.machine === "string" ? sp.machine : "";
  const defaultProductId = typeof sp?.productId === "string" ? Number(sp.productId) : undefined;

  const [products, locations, machines, recipes] = await Promise.all([
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
    prisma.productionMachine.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.productRecipeItem.findMany({
      include: {
        component: {
          include: {
            stockLocations: {
              include: { location: true },
            },
          },
        },
      },
    }),
  ]);

  const productionProducts = products.map((p) => ({
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
        <ProductionOrderForm
          products={productionProducts}
          locations={locations}
          machines={machines}
          recipes={recipes}
          defaultMachine={defaultMachine}
          defaultProductId={defaultProductId}
        />
      </div>
    </>
  );
}
