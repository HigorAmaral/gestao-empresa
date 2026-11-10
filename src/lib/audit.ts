import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
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
    const existing = await prisma.companySettings.findUnique({ where: { id: 1 } });
    if (existing) return existing;
    return prisma.companySettings.create({ data: { id: 1 } });
  },
  ["company-settings"],
  { tags: ["company-settings"], revalidate: 3600 },
);
