import { prisma } from "@/lib/prisma";

let tablesChecked = false;

/**
 * Garante que as tabelas `StockLocation` e `ProductStockLocation` existam no banco de dados.
 * Cria automaticamente com `CREATE TABLE IF NOT EXISTS` no PostgreSQL (ou SQLite),
 * evitando o erro "relation does not exist" no Vercel/Supabase quando o schema é atualizado.
 */
export async function ensureStockLocationTables(): Promise<void> {
  if (tablesChecked) return;

  try {
    // 1. Cria a tabela StockLocation no PostgreSQL
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StockLocation" (
        "id" SERIAL PRIMARY KEY,
        "code" VARCHAR(100) NOT NULL UNIQUE,
        "aisle" VARCHAR(100),
        "rack" VARCHAR(100),
        "shelf" VARCHAR(100),
        "bin" VARCHAR(100),
        "description" TEXT,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Cria a tabela ProductStockLocation no PostgreSQL
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ProductStockLocation" (
        "id" SERIAL PRIMARY KEY,
        "productId" INTEGER NOT NULL,
        "locationId" INTEGER NOT NULL,
        "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "notes" TEXT,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ProductStockLocation_productId_locationId_key" UNIQUE ("productId", "locationId"),
        CONSTRAINT "ProductStockLocation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE,
        CONSTRAINT "ProductStockLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE CASCADE
      );
    `);

    // 3. Índices para buscas rápidas
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ProductStockLocation_productId_idx" ON "ProductStockLocation"("productId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ProductStockLocation_locationId_idx" ON "ProductStockLocation"("locationId");
    `);

    // 4. Cria alguns endereços padrão caso a tabela esteja totalmente vazia
    const count = await prisma.stockLocation.count().catch(() => 0);
    if (count === 0) {
      await prisma.stockLocation.createMany({
        data: [
          { code: "A-01-01", aisle: "Corredor A", rack: "Estante 01", shelf: "Nível 01", bin: "Vão 01", description: "Área de entrada e picking rápido" },
          { code: "A-01-02", aisle: "Corredor A", rack: "Estante 01", shelf: "Nível 02", bin: "Vão 01", description: "Prateleira intermediária" },
          { code: "B-01-01", aisle: "Corredor B", rack: "Estante 01", shelf: "Nível 01", bin: "Gaveta 01", description: "Peças pequenas e periféricos" },
          { code: "C-01-01", aisle: "Corredor C", rack: "Estante 01", shelf: "Térreo", bin: "Palete 01", description: "Móveis e caixas pesadas" },
        ],
        skipDuplicates: true,
      }).catch(() => {});
    }

    tablesChecked = true;
  } catch (pgError) {
    // Fallback caso esteja em ambiente SQLite (desenvolvimento local)
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "StockLocation" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "code" TEXT NOT NULL UNIQUE,
          "aisle" TEXT,
          "rack" TEXT,
          "shelf" TEXT,
          "bin" TEXT,
          "description" TEXT,
          "active" BOOLEAN NOT NULL DEFAULT 1,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ProductStockLocation" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "productId" INTEGER NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
          "locationId" INTEGER NOT NULL REFERENCES "StockLocation"("id") ON DELETE CASCADE,
          "quantity" REAL NOT NULL DEFAULT 0,
          "notes" TEXT,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE ("productId", "locationId")
        );
      `);
      tablesChecked = true;
    } catch (sqliteError) {
      console.error("Falha ao inicializar tabelas de endereçamento:", pgError, sqliteError);
    }
  }
}
