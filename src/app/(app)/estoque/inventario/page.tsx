import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { PageHeader } from "@/components/ui";
import { InventoryClient } from "./InventoryClient";

export default async function InventarioEstoquePage() {
  await requireUser();
  await ensureStockLocationTables();

  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: {
      stockLocations: {
        include: { location: true },
      },
    },
  });

  const rows = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category,
    unit: p.unit,
    stock: p.stock,
    costPrice: p.costPrice,
    locations: p.stockLocations.map((sl) => `${sl.location.code} (${sl.quantity})`),
  }));

  return (
    <>
      <PageHeader
        title="Inventário & Balanço de Estoque (Contagem Cega)"
        subtitle="Conferência física de mercadorias e matérias-primas com apuração de divergências e ajuste automático em lote"
        actions={
          <Link className="btn secondary" href="/estoque">
            <ArrowLeft size={15} /> Voltar ao Estoque
          </Link>
        }
      />

      <InventoryClient products={rows} />
    </>
  );
}
