import { prisma } from "@/lib/prisma";

let tablesChecked = false;

/**
 * Garante que as tabelas de endereçamento, recebimento de mercadorias e ordens de produção existam no banco de dados.
 * Cria automaticamente com `CREATE TABLE IF NOT EXISTS` no PostgreSQL (ou SQLite),
 * evitando o erro "relation does not exist" no Vercel/Supabase quando o schema é atualizado.
 */
export async function ensureStockLocationTables(): Promise<void> {
  if (tablesChecked) return;
  if (!process.env.DATABASE_URL) return;

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

    // 3. Cria a tabela GoodsReceipt (Recebimento de Mercadorias)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "GoodsReceipt" (
        "id" SERIAL PRIMARY KEY,
        "code" VARCHAR(100) NOT NULL UNIQUE,
        "invoiceNumber" VARCHAR(100),
        "supplierId" INTEGER,
        "purchaseId" INTEGER,
        "status" VARCHAR(50) NOT NULL DEFAULT 'RECEBIDO',
        "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "notes" TEXT,
        "userId" INTEGER,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "GoodsReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL,
        CONSTRAINT "GoodsReceipt_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL,
        CONSTRAINT "GoodsReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
      );
    `);

    // 4. Cria a tabela GoodsReceiptItem
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "GoodsReceiptItem" (
        "id" SERIAL PRIMARY KEY,
        "receiptId" INTEGER NOT NULL,
        "productId" INTEGER NOT NULL,
        "quantity" DOUBLE PRECISION NOT NULL,
        "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "locationId" INTEGER,
        "batch" VARCHAR(100),
        "notes" TEXT,
        CONSTRAINT "GoodsReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE,
        CONSTRAINT "GoodsReceiptItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT,
        CONSTRAINT "GoodsReceiptItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL
      );
    `);

    // 5. Cria a tabela ProductionOrder (Ordens de Produção - OP)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ProductionOrder" (
        "id" SERIAL PRIMARY KEY,
        "code" VARCHAR(100) NOT NULL UNIQUE,
        "productId" INTEGER NOT NULL,
        "quantity" DOUBLE PRECISION NOT NULL,
        "machine" VARCHAR(150) NOT NULL,
        "operatorName" VARCHAR(150),
        "priority" VARCHAR(50) NOT NULL DEFAULT 'NORMAL',
        "status" VARCHAR(50) NOT NULL DEFAULT 'PLANEJADA',
        "startDate" TIMESTAMP(3),
        "deliveryDate" TIMESTAMP(3),
        "completedAt" TIMESTAMP(3),
        "notes" TEXT,
        "userId" INTEGER,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ProductionOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT,
        CONSTRAINT "ProductionOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
      );
    `);

    // 6. Cria a tabela ProductionOrderItem (Insumos da OP para entrega na máquina)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ProductionOrderItem" (
        "id" SERIAL PRIMARY KEY,
        "productionOrderId" INTEGER NOT NULL,
        "productId" INTEGER NOT NULL,
        "quantityRequired" DOUBLE PRECISION NOT NULL,
        "locationId" INTEGER,
        "notes" TEXT,
        CONSTRAINT "ProductionOrderItem_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE,
        CONSTRAINT "ProductionOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT,
        CONSTRAINT "ProductionOrderItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL
      );
    `);

    // Índices
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ProductStockLocation_productId_idx" ON "ProductStockLocation"("productId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ProductStockLocation_locationId_idx" ON "ProductStockLocation"("locationId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "GoodsReceipt_code_idx" ON "GoodsReceipt"("code");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ProductionOrder_code_idx" ON "ProductionOrder"("code");`);

    // Endereços padrão caso a tabela esteja totalmente vazia
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
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "GoodsReceipt" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "code" TEXT NOT NULL UNIQUE,
          "invoiceNumber" TEXT,
          "supplierId" INTEGER REFERENCES "Supplier"("id") ON DELETE SET NULL,
          "purchaseId" INTEGER REFERENCES "Purchase"("id") ON DELETE SET NULL,
          "status" TEXT NOT NULL DEFAULT 'RECEBIDO',
          "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "notes" TEXT,
          "userId" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "GoodsReceiptItem" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "receiptId" INTEGER NOT NULL REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE,
          "productId" INTEGER NOT NULL REFERENCES "Product"("id"),
          "quantity" REAL NOT NULL,
          "unitCost" REAL NOT NULL DEFAULT 0,
          "locationId" INTEGER REFERENCES "StockLocation"("id") ON DELETE SET NULL,
          "batch" TEXT,
          "notes" TEXT
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ProductionOrder" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "code" TEXT NOT NULL UNIQUE,
          "productId" INTEGER NOT NULL REFERENCES "Product"("id"),
          "quantity" REAL NOT NULL,
          "machine" TEXT NOT NULL,
          "operatorName" TEXT,
          "priority" TEXT NOT NULL DEFAULT 'NORMAL',
          "status" TEXT NOT NULL DEFAULT 'PLANEJADA',
          "startDate" DATETIME,
          "deliveryDate" DATETIME,
          "completedAt" DATETIME,
          "notes" TEXT,
          "userId" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ProductionOrderItem" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "productionOrderId" INTEGER NOT NULL REFERENCES "ProductionOrder"("id") ON DELETE CASCADE,
          "productId" INTEGER NOT NULL REFERENCES "Product"("id"),
          "quantityRequired" REAL NOT NULL,
          "locationId" INTEGER REFERENCES "StockLocation"("id") ON DELETE SET NULL,
          "notes" TEXT
        );
      `);
      tablesChecked = true;
    } catch (sqliteError) {
      console.error("Falha ao inicializar tabelas auxiliares:", pgError, sqliteError);
    }
  }
}
