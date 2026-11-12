import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { PageHeader } from "@/components/ui";
import { PdvClient } from "./PdvClient";

export default async function PdvPage() {
  await requireUser();
  await ensureStockLocationTables();

  const [products, clients, activeSession, recentSessions] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        sku: true,
        name: true,
        category: true,
        unit: true,
        salePrice: true,
        stock: true,
      },
    }),
    prisma.client.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, document: true },
    }),
    prisma.cashSession.findFirst({
      where: { status: "ABERTO" },
      orderBy: { openedAt: "desc" },
    }),
    prisma.cashSession.findMany({
      orderBy: { openedAt: "desc" },
      take: 10,
    }),
  ]);

  const serializeSession = (s: NonNullable<typeof activeSession>) => ({
    id: s.id,
    userName: s.userName,
    status: s.status,
    openedAt: s.openedAt.toISOString(),
    closedAt: s.closedAt ? s.closedAt.toISOString() : null,
    openingBalance: s.openingBalance,
    closingBalance: s.closingBalance,
    totalCash: s.totalCash,
    totalPix: s.totalPix,
    totalCard: s.totalCard,
    totalOther: s.totalOther,
    withdrawals: s.withdrawals,
    supplies: s.supplies,
    salesCount: s.salesCount,
    notes: s.notes,
  });

  return (
    <>
      <PageHeader
        title="PDV — Frente de Caixa Rápido"
        subtitle="Vendas ágeis de balcão com leitura de código de barras, cálculo de troco, pagamento misto e controle de gaveta"
        actions={
          <Link className="btn secondary" href="/vendas">
            <ShoppingCart size={15} /> Histórico de Vendas
          </Link>
        }
      />

      <PdvClient
        products={products}
        clients={clients}
        activeSession={activeSession ? serializeSession(activeSession) : null}
        recentSessions={recentSessions.map(serializeSession)}
      />
    </>
  );
}
