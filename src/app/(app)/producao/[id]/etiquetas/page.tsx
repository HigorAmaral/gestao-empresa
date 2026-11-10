import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "@/lib/audit";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { EtiquetasView } from "./EtiquetasView";

export default async function ProductionOrderLabelsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await ensureStockLocationTables();

  const [order, company] = await Promise.all([
    prisma.productionOrder.findUnique({
      where: { id: Number(id) },
      include: {
        product: true,
      },
    }),
    getCompanySettings(),
  ]);

  if (!order) notFound();

  return <EtiquetasView order={order} company={company} />;
}
