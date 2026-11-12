import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Ajusta o pool de conexões para ambiente serverless (Vercel + Neon).
 * O padrão do Prisma (núcleos × 2 + 1 ≈ 5) enfileira as ~20 consultas paralelas do Dashboard.
 * Só aplica se a URL ainda não definir `connection_limit`.
 */
function tunedDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw || !raw.startsWith("postgres")) return raw;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "10");
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "20");
    return url.toString();
  } catch {
    return raw;
  }
}

const datasourceUrl = tunedDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient(datasourceUrl ? { datasourceUrl } : undefined);

// Reutiliza a mesma instância entre invocações quentes (dev e produção)
globalForPrisma.prisma = prisma;
