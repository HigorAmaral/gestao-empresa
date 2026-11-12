import { unstable_cache } from "next/cache";
import { todayUTC } from "./format";
import { prisma } from "./prisma";
import { ensureStockLocationTables } from "./stock-location";
import type { Session } from "./token";

export async function logAudit(
  session: Session | { userId?: number | null; name: string },
  module: string,
  action: string,
  details: string,
  entityId?: number | string | null,
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: session.userId ?? null,
        userName: session.name,
        module,
        action,
        entityId: entityId != null ? String(entityId) : null,
        details,
      },
    });
  } catch (e) {
    console.error("Falha ao registrar auditoria:", e);
  }
}

export const getCompanySettings = unstable_cache(
  async () => {
    await ensureStockLocationTables();
    const existing = await prisma.companySettings.findUnique({ where: { id: 1 } });
    if (existing) return existing;
    return prisma.companySettings.create({ data: { id: 1 } });
  },
  ["company-settings"],
  { tags: ["company-settings"], revalidate: 3600 },
);

export type SidebarAlerts = {
  os: number;
  estoque: number;
  financeiro: number;
};

export const getSidebarAlerts = unstable_cache(
  async (): Promise<SidebarAlerts> => {
    const today = todayUTC();
    const [openOs, lowStockRows, overdueFin] = await Promise.all([
      prisma.serviceOrder.count({
        where: { status: { in: ["ABERTA", "EM_ANDAMENTO", "AGUARDANDO_PECA"] } },
      }),
      prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM "Product" WHERE active = true AND stock <= "minStock"`,
      prisma.financialEntry.count({
        where: { status: "PENDENTE", dueDate: { lt: today } },
      }),
    ]);
    return {
      os: openOs,
      estoque: Number(lowStockRows[0]?.c ?? 0),
      financeiro: overdueFin,
    };
  },
  ["sidebar-alerts"],
  { tags: ["sidebar-alerts"], revalidate: 30 },
);
