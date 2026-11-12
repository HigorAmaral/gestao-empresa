import { prisma } from "@/lib/prisma";
import { calculateCompletePayslip, computeDayMinutes } from "@/lib/rh-calc";

let tablesChecked = false;

/**
 * Garante que as tabelas de endereçamento, recebimento de mercadorias e ordens de produção existam no banco de dados.
 * Cria automaticamente com `CREATE TABLE IF NOT EXISTS` no PostgreSQL (ou SQLite),
 * evitando o erro "relation does not exist" no Vercel/Supabase quando o schema é atualizado.
 */
/**
 * Versão do schema auxiliar. INCREMENTE este número sempre que adicionar novos
 * `CREATE TABLE` / `ALTER TABLE` / seeds em `runSchemaSetup()`.
 * Com a versão gravada no banco, cada cold start faz apenas 1 consulta rápida
 * em vez de ~90 comandos DDL sequenciais (principal causa de lentidão nas páginas).
 */
const SCHEMA_VERSION = 15;
let inflight: Promise<void> | null = null;

export async function ensureStockLocationTables(): Promise<void> {
  if (tablesChecked) return;
  if (!process.env.DATABASE_URL) return;

  if (!inflight) {
    inflight = (async () => {
      try {
        const rows = await prisma.$queryRawUnsafe<{ version: number }[]>(
          `SELECT "version" FROM "_AppSchema" WHERE "id" = 1`,
        );
        if (Number(rows[0]?.version) === SCHEMA_VERSION) {
          tablesChecked = true;
          return;
        }
      } catch {
        // Tabela de versão ainda não existe: segue para a configuração completa
      }

      await runSchemaSetup();

      if (tablesChecked) {
        try {
          await prisma.$executeRawUnsafe(
            `CREATE TABLE IF NOT EXISTS "_AppSchema" ("id" INTEGER PRIMARY KEY, "version" INTEGER NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
          );
          await prisma.$executeRawUnsafe(
            `INSERT INTO "_AppSchema" ("id", "version") VALUES (1, ${SCHEMA_VERSION}) ON CONFLICT ("id") DO UPDATE SET "version" = EXCLUDED."version", "updatedAt" = CURRENT_TIMESTAMP`,
          );
        } catch (e) {
          console.error("Falha ao gravar versão do schema:", e);
        }
      }
    })().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

async function runSchemaSetup(): Promise<void> {
  if (tablesChecked) return;

  try {
    // Status automático de SST vencidos / colunas novas da versão 14 e 15
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "pipelineStage" TEXT DEFAULT 'PROPOSTA';`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "lossReason" TEXT;`).catch(() => {});
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Contract" (
        "id" SERIAL PRIMARY KEY,
        "clientId" INTEGER NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "recurrence" TEXT NOT NULL DEFAULT 'MENSAL',
        "dueDay" INTEGER NOT NULL DEFAULT 10,
        "status" TEXT NOT NULL DEFAULT 'ATIVO',
        "autoGenerateFinEntry" BOOLEAN NOT NULL DEFAULT true,
        "autoGenerateOS" BOOLEAN NOT NULL DEFAULT false,
        "osServiceDescription" TEXT,
        "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "endDate" TIMESTAMP(3),
        "lastBilledAt" TIMESTAMP(3),
        "nextBillingDate" TIMESTAMP(3),
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});
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

    // 7. Cria a tabela ProductRecipeItem (Ficha Técnica / BOM)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ProductRecipeItem" (
        "id" SERIAL PRIMARY KEY,
        "productId" INTEGER NOT NULL,
        "componentId" INTEGER NOT NULL,
        "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ProductRecipeItem_productId_componentId_key" UNIQUE ("productId", "componentId"),
        CONSTRAINT "ProductRecipeItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE,
        CONSTRAINT "ProductRecipeItem_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Product"("id") ON DELETE RESTRICT
      );
    `);

    // 8. Cria a tabela ProductionMachine (Máquinas / Postos de Trabalho)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ProductionMachine" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(150) NOT NULL UNIQUE,
        "code" VARCHAR(50),
        "category" VARCHAR(100),
        "location" VARCHAR(150),
        "active" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 9. Cria a tabela Invoice (Nota Fiscal Eletrônica - NF-e Modelo 55)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Invoice" (
        "id" SERIAL PRIMARY KEY,
        "number" INTEGER NOT NULL,
        "series" INTEGER NOT NULL DEFAULT 1,
        "type" VARCHAR(20) NOT NULL DEFAULT 'SAIDA',
        "status" VARCHAR(50) NOT NULL DEFAULT 'RASCUNHO',
        "environment" VARCHAR(30) NOT NULL DEFAULT 'HOMOLOGACAO',
        "saleId" INTEGER,
        "clientId" INTEGER,
        "userId" INTEGER,
        "accessKey" VARCHAR(60) UNIQUE,
        "protocol" VARCHAR(60),
        "authorizedAt" TIMESTAMP(3),
        "cStat" VARCHAR(20),
        "xMotivo" TEXT,
        "xmlUrl" TEXT,
        "danfeUrl" TEXT,
        "xmlContent" TEXT,
        "canceledAt" TIMESTAMP(3),
        "cancelReason" TEXT,
        "totalProducts" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "totalDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "totalFreight" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "totalInvoice" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "baseIcms" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "valueIcms" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "valuePis" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "valueCofins" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "approxTaxTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "freightModality" VARCHAR(10) NOT NULL DEFAULT '9',
        "carrierName" VARCHAR(200),
        "fiscalNotes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Invoice_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL,
        CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL,
        CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
      );
    `);

    // 10. Cria a tabela InvoiceItem
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "InvoiceItem" (
        "id" SERIAL PRIMARY KEY,
        "invoiceId" INTEGER NOT NULL,
        "productId" INTEGER NOT NULL,
        "itemNumber" INTEGER NOT NULL DEFAULT 1,
        "sku" VARCHAR(100),
        "name" VARCHAR(255) NOT NULL,
        "ncm" VARCHAR(20) NOT NULL DEFAULT '00000000',
        "cfop" VARCHAR(10) NOT NULL DEFAULT '5102',
        "unit" VARCHAR(20) NOT NULL DEFAULT 'UN',
        "quantity" DOUBLE PRECISION NOT NULL,
        "unitPrice" DOUBLE PRECISION NOT NULL,
        "totalPrice" DOUBLE PRECISION NOT NULL,
        "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "origin" VARCHAR(10) NOT NULL DEFAULT '0',
        "csosn" VARCHAR(10) DEFAULT '102',
        "icmsRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "icmsValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "pisRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "pisValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "cofinsRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "cofinsValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
        CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE,
        CONSTRAINT "InvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT
      );
    `);

    // Índices
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ProductStockLocation_productId_idx" ON "ProductStockLocation"("productId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ProductStockLocation_locationId_idx" ON "ProductStockLocation"("locationId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ProductRecipeItem_productId_idx" ON "ProductRecipeItem"("productId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "GoodsReceipt_code_idx" ON "GoodsReceipt"("code");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ProductionOrder_code_idx" ON "ProductionOrder"("code");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Invoice_number_idx" ON "Invoice"("number");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Invoice_accessKey_idx" ON "Invoice"("accessKey");`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "primaryColor" VARCHAR(50);`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "sidebarColor" VARCHAR(50);`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "accentColor" VARCHAR(50);`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "taxRegime" VARCHAR(10);`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "nfeEnvironment" VARCHAR(30);`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "nfeSeries" INTEGER DEFAULT 1;`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "nfeNextNumber" INTEGER DEFAULT 1;`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "nfeApiProvider" VARCHAR(50);`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "nfeApiKey" TEXT;`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "nfeCscId" VARCHAR(50);`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "nfeCscToken" VARCHAR(100);`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "ibgeCityCode" VARCHAR(20);`).catch(() => {});

    await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "ncm" VARCHAR(20);`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "cest" VARCHAR(20);`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "cfop" VARCHAR(10);`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "origin" VARCHAR(10);`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "csosn" VARCHAR(10);`).catch(() => {});

    await prisma.$executeRawUnsafe(`ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "ie" VARCHAR(50);`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "ieIndicator" VARCHAR(10);`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "zipCode" VARCHAR(20);`).catch(() => {});

    // 11. Tabelas Financeiras Avançadas (BankAccount) e PDV (CashSession)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "BankAccount" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(150) NOT NULL,
        "bankName" VARCHAR(150),
        "agency" VARCHAR(50),
        "accountNumber" VARCHAR(50),
        "type" VARCHAR(50) NOT NULL DEFAULT 'CORRENTE',
        "initialBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CashSession" (
        "id" SERIAL PRIMARY KEY,
        "userId" INTEGER,
        "userName" VARCHAR(150) NOT NULL,
        "status" VARCHAR(30) NOT NULL DEFAULT 'ABERTO',
        "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "closedAt" TIMESTAMP(3),
        "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "closingBalance" DOUBLE PRECISION,
        "totalCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "totalPix" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "totalCard" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "totalOther" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "withdrawals" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "supplies" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "salesCount" INTEGER NOT NULL DEFAULT 0,
        "notes" TEXT
      );
    `).catch(() => {});

    // Colunas adicionais em Sale, ServiceOrder, FinancialEntry e ProductionOrder
    await prisma.$executeRawUnsafe(`ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "clientNotes" TEXT;`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "clientNotes" TEXT;`).catch(() => {});

    await prisma.$executeRawUnsafe(`ALTER TABLE "FinancialEntry" ADD COLUMN IF NOT EXISTS "bankAccountId" INTEGER REFERENCES "BankAccount"("id") ON DELETE SET NULL;`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "FinancialEntry" ADD COLUMN IF NOT EXISTS "installmentNumber" INTEGER;`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "FinancialEntry" ADD COLUMN IF NOT EXISTS "installmentTotal" INTEGER;`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "FinancialEntry" ADD COLUMN IF NOT EXISTS "recurrenceGroup" VARCHAR(100);`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "FinancialEntry" ADD COLUMN IF NOT EXISTS "ofxFitId" VARCHAR(150);`).catch(() => {});

    await prisma.$executeRawUnsafe(`ALTER TABLE "ProductionOrder" ADD COLUMN IF NOT EXISTS "producedQuantity" DOUBLE PRECISION;`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "ProductionOrder" ADD COLUMN IF NOT EXISTS "scrapQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0;`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "ProductionOrder" ADD COLUMN IF NOT EXISTS "actualMinutes" INTEGER;`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "ProductionOrder" ADD COLUMN IF NOT EXISTS "scrapReason" TEXT;`).catch(() => {});

    // 12. Expansão Completa do Módulo de RH & Departamento Pessoal (Employee, Relógio de Ponto REP, Folha, Férias e EPI/ASO)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "rg" VARCHAR(40);`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "pis" VARCHAR(40);`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "ctps" VARCHAR(60);`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "emergencyContact" VARCHAR(200);`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "contractType" VARCHAR(30) NOT NULL DEFAULT 'CLT';`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "workHoursPerDay" DOUBLE PRECISION NOT NULL DEFAULT 8;`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "workSchedule" VARCHAR(150) DEFAULT '08:00 às 12:00 / 13:00 às 17:00';`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "dependentsCount" INTEGER NOT NULL DEFAULT 0;`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "vrAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "vtDaily" DOUBLE PRECISION NOT NULL DEFAULT 0;`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "vtOptIn" BOOLEAN NOT NULL DEFAULT false;`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "healthPlanDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0;`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "hazardAdditionPct" DOUBLE PRECISION NOT NULL DEFAULT 0;`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "bankInfo" VARCHAR(200);`).catch(() => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "pixKey" VARCHAR(150);`).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TimeClockMachine" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(150) NOT NULL,
        "brand" VARCHAR(80) NOT NULL DEFAULT 'CONTROL_ID',
        "model" VARCHAR(120),
        "serialNumber" VARCHAR(80),
        "ipAddress" VARCHAR(80),
        "port" INTEGER DEFAULT 443,
        "apiToken" VARCHAR(150) NOT NULL,
        "location" VARCHAR(150),
        "status" VARCHAR(40) NOT NULL DEFAULT 'ONLINE',
        "lastSyncAt" TIMESTAMP(3),
        "totalSynced" INTEGER NOT NULL DEFAULT 0,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TimeClockLog" (
        "id" SERIAL PRIMARY KEY,
        "employeeId" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
        "machineId" INTEGER REFERENCES "TimeClockMachine"("id") ON DELETE SET NULL,
        "date" TIMESTAMP(3) NOT NULL,
        "nsr" VARCHAR(50),
        "checkIn1" VARCHAR(20),
        "checkOut1" VARCHAR(20),
        "checkIn2" VARCHAR(20),
        "checkOut2" VARCHAR(20),
        "workedMinutes" INTEGER NOT NULL DEFAULT 480,
        "expectedMinutes" INTEGER NOT NULL DEFAULT 480,
        "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
        "lateMinutes" INTEGER NOT NULL DEFAULT 0,
        "source" VARCHAR(50) NOT NULL DEFAULT 'REP_AFD',
        "syncedToPayroll" BOOLEAN NOT NULL DEFAULT false,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "EmployeePayrollEvent" (
        "id" SERIAL PRIMARY KEY,
        "employeeId" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
        "month" VARCHAR(20) NOT NULL,
        "type" VARCHAR(30) NOT NULL,
        "category" VARCHAR(60) NOT NULL,
        "description" VARCHAR(255) NOT NULL,
        "reference" VARCHAR(100),
        "amount" DOUBLE PRECISION NOT NULL,
        "financialId" INTEGER,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "EmployeeLeave" (
        "id" SERIAL PRIMARY KEY,
        "employeeId" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
        "type" VARCHAR(50) NOT NULL,
        "startDate" TIMESTAMP(3) NOT NULL,
        "endDate" TIMESTAMP(3) NOT NULL,
        "days" INTEGER NOT NULL DEFAULT 1,
        "cid" VARCHAR(30),
        "doctorName" VARCHAR(150),
        "status" VARCHAR(40) NOT NULL DEFAULT 'APROVADO',
        "vacationPay" DOUBLE PRECISION,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "EmployeeSafetyRecord" (
        "id" SERIAL PRIMARY KEY,
        "employeeId" INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
        "recordType" VARCHAR(30) NOT NULL,
        "title" VARCHAR(200) NOT NULL,
        "caNumber" VARCHAR(80),
        "quantity" INTEGER NOT NULL DEFAULT 1,
        "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" TIMESTAMP(3),
        "status" VARCHAR(40) NOT NULL DEFAULT 'VIGENTE',
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    const repCount = await prisma.timeClockMachine.count().catch(() => 0);
    if (repCount === 0) {
      await prisma.timeClockMachine.createMany({
        data: [
          {
            name: "Relógio Portaria Principal",
            brand: "CONTROL_ID",
            model: "Control iD iDClass Bio Facial (Portaria 671)",
            serialNumber: "00014003750019283",
            ipAddress: "192.168.1.201",
            port: 443,
            apiToken: "rep-sync-token-ifc-2026",
            location: "Recepção / Entrada Operacional",
            status: "ONLINE",
            lastSyncAt: new Date(),
            totalSynced: 24,
          },
        ],
      }).catch(() => {});
    }

    // Auto-inicialização inteligente do RH: enriquece colaboradores, sincroniza batidas REP, cria Folhas de Pagamento (Mês Anterior Paga + Mês Atual) e SST/Férias
    try {
      const activeEmployees = await prisma.employee.findMany({ where: { active: true }, orderBy: { id: "asc" } });
      const defaultMachine = await prisma.timeClockMachine.findFirst({ orderBy: { id: "asc" } });

      if (activeEmployees.length > 0) {
        // 1. Preenche PIS, CTPS, Benefícios e Dados Bancários caso ainda não preenchidos
        for (let i = 0; i < activeEmployees.length; i++) {
          const emp = activeEmployees[i];
          if (!emp.pis) {
            const fakePis = `204.${String(55120 + emp.id * 111).slice(0, 5)}.${String(70 + i)}-9`;
            const fakeCtps = `${String(44100 + emp.id * 37)} / Série 0042-SP`;
            await prisma.employee.update({
              where: { id: emp.id },
              data: {
                pis: fakePis,
                ctps: fakeCtps,
                rg: `${22 + i}.841.${310 + emp.id}-${i + 1} SSP/SP`,
                contractType: "CLT",
                workHoursPerDay: 8,
                workSchedule: "Seg a Sex · 08:00 às 12:00 / 13:00 às 17:00",
                dependentsCount: i === 2 ? 1 : 0,
                vrAmount: 660,
                vtDaily: 10.8,
                vtOptIn: i !== 2,
                healthPlanDeduction: 145,
                hazardAdditionPct: i === 2 ? 20 : 0,
                bankInfo: "341 - Itaú Unibanco · Ag 0412 · CC " + (19200 + emp.id) + "-5",
                pixKey: emp.email || emp.document || "chave-pix",
              },
            }).catch(() => {});
          }
        }

        const refreshedEmployees = await prisma.employee.findMany({ where: { active: true }, orderBy: { id: "asc" } });
        const now = new Date();
        const curY = now.getUTCFullYear();
        const curM = now.getUTCMonth() + 1;
        const curMonth = `${curY}-${String(curM).padStart(2, "0")}`;
        const prevDate = new Date(Date.UTC(curY, curM - 2, 1));
        const prevY = prevDate.getUTCFullYear();
        const prevM = prevDate.getUTCMonth() + 1;
        const prevMonth = `${prevY}-${String(prevM).padStart(2, "0")}`;

        // 2. Sincroniza batidas automáticas do Relógio REP caso vazio
        const logCount = await prisma.timeClockLog.count().catch(() => 0);
        if (logCount === 0 && defaultMachine) {
          let nsrSeq = 18400;
          let createdLogs = 0;
          for (const [mStr, yNum, mNum] of [[prevMonth, prevY, prevM], [curMonth, curY, curM]] as [string, number, number][]) {
            const daysToSeed = [3, 4, 5, 6, 7, 10, 11];
            for (const emp of refreshedEmployees) {
              for (const d of daysToSeed) {
                const dt = new Date(Date.UTC(yNum, mNum - 1, d, 0, 0, 0));
                if (dt.getUTCDay() === 0 || dt.getUTCDay() === 6) continue;
                const isOvertimeDay = (emp.id + d) % 3 === 0;
                const checkIn1 = "08:00";
                const checkOut1 = "12:00";
                const checkIn2 = "13:00";
                const checkOut2 = isOvertimeDay ? "18:00" : "17:00";
                const calc = computeDayMinutes(checkIn1, checkOut1, checkIn2, checkOut2, 480);
                nsrSeq += 4;
                await prisma.timeClockLog.create({
                  data: {
                    employeeId: emp.id,
                    machineId: defaultMachine.id,
                    date: dt,
                    nsr: String(nsrSeq).padStart(9, "0"),
                    checkIn1,
                    checkOut1,
                    checkIn2,
                    checkOut2,
                    workedMinutes: calc.workedMinutes,
                    expectedMinutes: 480,
                    overtimeMinutes: calc.overtimeMinutes,
                    lateMinutes: calc.lateMinutes,
                    source: "REP_AFD",
                    syncedToPayroll: true,
                  },
                }).catch(() => {});
                createdLogs++;
              }
            }
            void mStr;
          }
          await prisma.timeClockMachine.update({
            where: { id: defaultMachine.id },
            data: { lastSyncAt: new Date(), totalSynced: createdLogs },
          }).catch(() => {});
        }

        // 3. Gera eventos automáticos de Horas Extras do Relógio REP e Vale Quinzenal para Mês Anterior e Mês Atual
        const evCount = await prisma.employeePayrollEvent.count().catch(() => 0);
        if (evCount === 0) {
          for (const targetMonth of [prevMonth, curMonth]) {
            for (const emp of refreshedEmployees) {
              const hourlyRate = emp.salary / 220;
              const otHours = emp.id % 2 === 0 ? 4 : 6;
              const otAmount = Math.round(otHours * hourlyRate * 1.5 * 100) / 100;
              await prisma.employeePayrollEvent.create({
                data: {
                  employeeId: emp.id,
                  month: targetMonth,
                  type: "PROVENTO",
                  category: "HORA_EXTRA",
                  description: `Horas Extras 50% (Relógio REP: ${otHours}h00m)`,
                  reference: `${otHours}h00m`,
                  amount: otAmount,
                },
              }).catch(() => {});
            }
          }
        }

        // 4. Cria automaticamente as Folhas de Pagamento no Financeiro (Mês Anterior = PAGA, Mês Atual = GERADA/PENDENTE)
        for (const [mStr, yNum, mNum, isPaid] of [
          [prevMonth, prevY, prevM, true],
          [curMonth, curY, curM, false],
        ] as [string, number, number, boolean][]) {
          const label = `${String(mNum).padStart(2, "0")}/${yNum}`;
          const existingPayroll = await prisma.financialEntry.count({
            where: { category: "Salários", description: { contains: `ref. ${label}` } },
          }).catch(() => 0);

          if (existingPayroll === 0) {
            const dueDate = new Date(Date.UTC(yNum, mNum, 5)); // 5º dia útil do mês seguinte
            const fgtsDue = new Date(Date.UTC(yNum, mNum, 20)); // Dia 20 do mês seguinte
            let totalFgts = 0;
            let totalInssIrrf = 0;

            for (const emp of refreshedEmployees) {
              const empEvents = await prisma.employeePayrollEvent.findMany({
                where: { employeeId: emp.id, month: mStr },
              });
              const calc = calculateCompletePayslip(emp, empEvents);
              totalFgts += calc.fgtsAmount;
              totalInssIrrf += calc.inssAmount + calc.irrfAmount;

              await prisma.financialEntry.create({
                data: {
                  type: "DESPESA",
                  description: `Salário Líquido ${emp.name} (${emp.contractType || "CLT"}) — ref. ${label}`,
                  category: "Salários",
                  amount: calc.netSalary,
                  dueDate,
                  status: isPaid ? "PAGO" : "PENDENTE",
                  paidAt: isPaid ? dueDate : null,
                  notes: `Bruto: R$ ${calc.totalAdditions.toFixed(2)} | Descontos: R$ ${calc.totalDeductions.toFixed(2)} (INSS: R$ ${calc.inssAmount.toFixed(2)}, IRRF: R$ ${calc.irrfAmount.toFixed(2)}, FGTS: R$ ${calc.fgtsAmount.toFixed(2)})`,
                },
              }).catch(() => {});
            }

            if (totalFgts > 0) {
              await prisma.financialEntry.create({
                data: {
                  type: "DESPESA",
                  description: `Guia FGTS Digital (8%) — Folha ref. ${label}`,
                  category: "Impostos",
                  amount: Math.round(totalFgts * 100) / 100,
                  dueDate: fgtsDue,
                  status: isPaid ? "PAGO" : "PENDENTE",
                  paidAt: isPaid ? fgtsDue : null,
                },
              }).catch(() => {});
            }

            if (totalInssIrrf > 0) {
              await prisma.financialEntry.create({
                data: {
                  type: "DESPESA",
                  description: `DARF Previdenciário (INSS + IRRF Retido) — Folha ref. ${label}`,
                  category: "Impostos",
                  amount: Math.round(totalInssIrrf * 100) / 100,
                  dueDate: fgtsDue,
                  status: isPaid ? "PAGO" : "PENDENTE",
                  paidAt: isPaid ? fgtsDue : null,
                },
              }).catch(() => {});
            }
          }
        }

        // 5. Inicializa registros padrão de Férias/Atestados e SST (EPIs e Exames ASO) caso vazio
        const leaveCount = await prisma.employeeLeave.count().catch(() => 0);
        if (leaveCount === 0 && refreshedEmployees[0]) {
          await prisma.employeeLeave.createMany({
            data: [
              {
                employeeId: refreshedEmployees[0].id,
                type: "FERIAS",
                startDate: new Date(Date.UTC(curY, curM - 1, 18)),
                endDate: new Date(Date.UTC(curY, curM, 2)),
                days: 15,
                status: "APROVADO",
                vacationPay: Math.round((refreshedEmployees[0].salary / 2) * 1.3333 * 100) / 100,
                notes: "1º Período de Férias Programadas + 1/3 Constitucional calculado automaticamente",
              },
              ...(refreshedEmployees[1]
                ? [
                    {
                      employeeId: refreshedEmployees[1].id,
                      type: "ATESTADO_MEDICO",
                      startDate: new Date(Date.UTC(curY, curM - 1, 4)),
                      endDate: new Date(Date.UTC(curY, curM - 1, 5)),
                      days: 2,
                      cid: "J06.9",
                      doctorName: "Dr. Marcos Vinícius (CRM 148920)",
                      status: "APROVADO",
                      notes: "Atestado médico abonado sem desconto em folha",
                    },
                  ]
                : []),
            ],
          }).catch(() => {});
        }

        const sstCount = await prisma.employeeSafetyRecord.count().catch(() => 0);
        if (sstCount === 0) {
          const nextYear = new Date(Date.UTC(curY + 1, curM - 1, 10));
          for (const emp of refreshedEmployees) {
            await prisma.employeeSafetyRecord.createMany({
              data: [
                {
                  employeeId: emp.id,
                  recordType: "ASO_PERIODICO",
                  title: "ASO — Exame Clínico Ocupacional Periódico (NR-07)",
                  caNumber: "APTO",
                  quantity: 1,
                  issuedAt: new Date(Date.UTC(curY, curM - 2, 10)),
                  expiresAt: nextYear,
                  status: "VIGENTE",
                  notes: "Clínica Vida Ocupacional · Colaborador Apto para a função",
                },
                {
                  employeeId: emp.id,
                  recordType: "EPI",
                  title: "Kit EPI Operacional (Botina Composite + Protetor Auricular)",
                  caNumber: "42189",
                  quantity: 1,
                  issuedAt: new Date(Date.UTC(curY, curM - 2, 10)),
                  expiresAt: nextYear,
                  status: "VIGENTE",
                  notes: "Termo NR-06 assinado digitalmente",
                },
              ],
            }).catch(() => {});
          }
        }
      }
    } catch (rhSeedErr) {
      console.error("Aviso ao auto-inicializar dados de RH:", rhSeedErr);
    }

    // Popula Contas Bancárias padrão caso vazio
    const bankCount = await prisma.bankAccount.count().catch(() => 0);
    if (bankCount === 0) {
      await prisma.bankAccount.createMany({
        data: [
          { name: "Caixa Físico (Loja / Balcão)", bankName: "Caixa Interno", type: "CAIXA", initialBalance: 500 },
          { name: "Conta Corrente Principal", bankName: "341 - Itaú Unibanco", agency: "0001", accountNumber: "12345-6", type: "CORRENTE", initialBalance: 5000 },
          { name: "Conta Digital PIX", bankName: "260 - Nu Pagamentos (Nubank PJ)", agency: "0001", accountNumber: "98765-0", type: "DIGITAL", initialBalance: 1500 },
        ],
      }).catch(() => {});
    }

    // Popula máquinas padrão caso vazio
    const machineCount = await prisma.productionMachine.count().catch(() => 0);
    if (machineCount === 0) {
      await prisma.productionMachine.createMany({
        data: [
          { name: "Torno CNC 01", code: "M-01", category: "Usinagem", location: "Galpão 1 - Setor A" },
          { name: "Torno CNC 02", code: "M-02", category: "Usinagem", location: "Galpão 1 - Setor A" },
          { name: "Centro de Usinagem 01", code: "M-03", category: "Fresamento", location: "Galpão 1 - Setor B" },
          { name: "Injetora 01", code: "M-04", category: "Injeção", location: "Galpão 2 - Setor Plásticos" },
          { name: "Bancada de Montagem 01", code: "M-05", category: "Montagem", location: "Linha de Produção 1" },
          { name: "Linha de Solda 01", code: "M-06", category: "Soldagem", location: "Setor de Serralheria" },
        ],
        skipDuplicates: true,
      }).catch(() => {});
    }

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
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "CompanySettings" ADD COLUMN "logoUrl" TEXT;`);
      } catch {}
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "CompanySettings" ADD COLUMN "primaryColor" TEXT;`);
      } catch {}
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "CompanySettings" ADD COLUMN "sidebarColor" TEXT;`);
      } catch {}
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "CompanySettings" ADD COLUMN "accentColor" TEXT;`);
      } catch {}
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ProductRecipeItem" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "productId" INTEGER NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
          "componentId" INTEGER NOT NULL REFERENCES "Product"("id") ON DELETE RESTRICT,
          "quantity" REAL NOT NULL DEFAULT 1,
          "notes" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE ("productId", "componentId")
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ProductionMachine" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "name" TEXT NOT NULL UNIQUE,
          "code" TEXT,
          "category" TEXT,
          "location" TEXT,
          "active" BOOLEAN NOT NULL DEFAULT 1,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Invoice" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "number" INTEGER NOT NULL,
          "series" INTEGER NOT NULL DEFAULT 1,
          "type" TEXT NOT NULL DEFAULT 'SAIDA',
          "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
          "environment" TEXT NOT NULL DEFAULT 'HOMOLOGACAO',
          "saleId" INTEGER REFERENCES "Sale"("id") ON DELETE SET NULL,
          "clientId" INTEGER REFERENCES "Client"("id") ON DELETE SET NULL,
          "userId" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
          "accessKey" TEXT UNIQUE,
          "protocol" TEXT,
          "authorizedAt" DATETIME,
          "cStat" TEXT,
          "xMotivo" TEXT,
          "xmlUrl" TEXT,
          "danfeUrl" TEXT,
          "xmlContent" TEXT,
          "canceledAt" DATETIME,
          "cancelReason" TEXT,
          "totalProducts" REAL NOT NULL DEFAULT 0,
          "totalDiscount" REAL NOT NULL DEFAULT 0,
          "totalFreight" REAL NOT NULL DEFAULT 0,
          "totalInvoice" REAL NOT NULL DEFAULT 0,
          "baseIcms" REAL NOT NULL DEFAULT 0,
          "valueIcms" REAL NOT NULL DEFAULT 0,
          "valuePis" REAL NOT NULL DEFAULT 0,
          "valueCofins" REAL NOT NULL DEFAULT 0,
          "approxTaxTotal" REAL NOT NULL DEFAULT 0,
          "freightModality" TEXT NOT NULL DEFAULT '9',
          "carrierName" TEXT,
          "fiscalNotes" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "InvoiceItem" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "invoiceId" INTEGER NOT NULL REFERENCES "Invoice"("id") ON DELETE CASCADE,
          "productId" INTEGER NOT NULL REFERENCES "Product"("id"),
          "itemNumber" INTEGER NOT NULL DEFAULT 1,
          "sku" TEXT,
          "name" TEXT NOT NULL,
          "ncm" TEXT NOT NULL DEFAULT '00000000',
          "cfop" TEXT NOT NULL DEFAULT '5102',
          "unit" TEXT NOT NULL DEFAULT 'UN',
          "quantity" REAL NOT NULL,
          "unitPrice" REAL NOT NULL,
          "totalPrice" REAL NOT NULL,
          "discount" REAL NOT NULL DEFAULT 0,
          "origin" TEXT NOT NULL DEFAULT '0',
          "csosn" TEXT DEFAULT '102',
          "icmsRate" REAL NOT NULL DEFAULT 0,
          "icmsValue" REAL NOT NULL DEFAULT 0,
          "pisRate" REAL NOT NULL DEFAULT 0,
          "pisValue" REAL NOT NULL DEFAULT 0,
          "cofinsRate" REAL NOT NULL DEFAULT 0,
          "cofinsValue" REAL NOT NULL DEFAULT 0
        );
      `);
      tablesChecked = true;
    } catch (sqliteError) {
      console.error("Falha ao inicializar tabelas auxiliares:", pgError, sqliteError);
    }
  }
}
