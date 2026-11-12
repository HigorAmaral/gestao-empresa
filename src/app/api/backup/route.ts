import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { ensureStockLocationTables } from "@/lib/stock-location";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Apenas administradores podem exportar o backup completo." }, { status: 403 });
  }

  await ensureStockLocationTables();

  const [
    companySettings,
    clients,
    suppliers,
    products,
    stockLocations,
    productStockLocations,
    recipes,
    machines,
    employees,
    sales,
    purchases,
    serviceOrders,
    productionOrders,
    goodsReceipts,
    bankAccounts,
    financialEntries,
    cashSessions,
    invoices,
  ] = await Promise.all([
    prisma.companySettings.findMany(),
    prisma.client.findMany(),
    prisma.supplier.findMany(),
    prisma.product.findMany(),
    prisma.stockLocation.findMany(),
    prisma.productStockLocation.findMany(),
    prisma.productRecipeItem.findMany(),
    prisma.productionMachine.findMany(),
    prisma.employee.findMany(),
    prisma.sale.findMany({ include: { items: true } }),
    prisma.purchase.findMany({ include: { items: true } }),
    prisma.serviceOrder.findMany({ include: { items: true } }),
    prisma.productionOrder.findMany({ include: { items: true } }),
    prisma.goodsReceipt.findMany({ include: { items: true } }),
    prisma.bankAccount.findMany(),
    prisma.financialEntry.findMany(),
    prisma.cashSession.findMany(),
    prisma.invoice.findMany({ include: { items: true } }),
  ]);

  const backupPayload = {
    meta: {
      system: "IFC ERP — Sistema de Gestão Empresarial",
      version: "2.0",
      exportedAt: new Date().toISOString(),
      exportedBy: session.name,
    },
    counts: {
      clients: clients.length,
      suppliers: suppliers.length,
      products: products.length,
      sales: sales.length,
      purchases: purchases.length,
      serviceOrders: serviceOrders.length,
      productionOrders: productionOrders.length,
      financialEntries: financialEntries.length,
      invoices: invoices.length,
    },
    data: {
      companySettings,
      clients,
      suppliers,
      products,
      stockLocations,
      productStockLocations,
      recipes,
      machines,
      employees,
      sales,
      purchases,
      serviceOrders,
      productionOrders,
      goodsReceipts,
      bankAccounts,
      financialEntries,
      cashSessions,
      invoices,
    },
  };

  await logAudit(session, "CONFIG", "BACKUP", "Exportou backup completo do banco de dados (.JSON)");

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `backup-erp-${dateStr}.json`;

  return new NextResponse(JSON.stringify(backupPayload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
