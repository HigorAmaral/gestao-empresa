import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

function getDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl && !envUrl.startsWith("file:")) {
    return envUrl;
  }
  // Na Vercel (ambiente serverless), o sistema de arquivos do projeto é somente leitura;
  // copiamos o banco inicial (prisma/seed.db) para /tmp/gestao.db na inicialização.
  if (process.env.VERCEL) {
    const tmpDb = "/tmp/gestao.db";
    if (!fs.existsSync(tmpDb)) {
      const candidates = [
        path.join(process.cwd(), "prisma", "seed.db"),
        path.join(__dirname, "..", "..", "prisma", "seed.db"),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          fs.copyFileSync(candidate, tmpDb);
          break;
        }
      }
    }
    return `file:${tmpDb}`;
  }
  return envUrl || "file:./dev.db";
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: { url: getDatabaseUrl() },
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
