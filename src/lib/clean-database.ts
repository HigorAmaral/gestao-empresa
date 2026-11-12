import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { ensureStockLocationTables } from "./stock-location";

export interface CleanDatabaseResult {
  preservedUsers: Array<{
    id: number;
    name: string;
    email: string;
    role: string;
  }>;
  summary: Record<string, number>;
}

export async function executeDatabaseCleanup(): Promise<CleanDatabaseResult> {
  // Garante que todas as tabelas e schemas mais recentes estejam criadas
  await ensureStockLocationTables();

  // 1. Identificar ou garantir o usuário Administrador de Higor
  const allUsers = await prisma.user.findMany();
  let higorUser = allUsers.find(
    (u) =>
      u.name.toLowerCase().includes("higor") ||
      u.name.toLowerCase().includes("amaral") ||
      u.name.toLowerCase().includes("fritz") ||
      u.name.toLowerCase().includes("frizt") ||
      u.email.toLowerCase().includes("higor") ||
      u.email.toLowerCase() === "amarahigor@gmail.com"
  );

  const adminHash = await bcrypt.hash("admin123", 10);
  const funcHash = await bcrypt.hash("func123", 10);

  if (!higorUser) {
    higorUser = await prisma.user.create({
      data: {
        name: "Higor do Amaral Fritz",
        email: "amarahigor@gmail.com",
        passwordHash: adminHash,
        role: "ADMIN",
        permissions:
          "vendas,os,clientes,produtos,estoque,compras,fornecedores,financeiro,relatorios,rh,producao,nfe,configuracoes",
        active: true,
      },
    });
  } else {
    higorUser = await prisma.user.update({
      where: { id: higorUser.id },
      data: {
        role: "ADMIN",
        active: true,
        permissions:
          "vendas,os,clientes,produtos,estoque,compras,fornecedores,financeiro,relatorios,rh,producao,nfe,configuracoes",
      },
    });
  }

  // 2. Garantir usuário de Acesso Rápido: Administrador Demo (admin@empresa.com)
  let demoAdmin = allUsers.find((u) => u.email.toLowerCase() === "admin@empresa.com");
  if (!demoAdmin) {
    demoAdmin = await prisma.user.create({
      data: {
        name: "Administrador",
        email: "admin@empresa.com",
        passwordHash: adminHash,
        role: "ADMIN",
        permissions:
          "vendas,os,clientes,produtos,estoque,compras,fornecedores,financeiro,relatorios,rh,producao,nfe,configuracoes",
        active: true,
      },
    });
  } else {
    demoAdmin = await prisma.user.update({
      where: { id: demoAdmin.id },
      data: {
        passwordHash: adminHash,
        role: "ADMIN",
        active: true,
      },
    });
  }

  // 3. Garantir usuário de Acesso Rápido: Funcionário Demo (func@empresa.com)
  let demoFunc = allUsers.find((u) => u.email.toLowerCase() === "func@empresa.com");
  if (!demoFunc) {
    demoFunc = await prisma.user.create({
      data: {
        name: "Funcionário",
        email: "func@empresa.com",
        passwordHash: funcHash,
        role: "FUNCIONARIO",
        permissions: "vendas,os,clientes,produtos,estoque,compras,fornecedores",
        active: true,
      },
    });
  } else {
    demoFunc = await prisma.user.update({
      where: { id: demoFunc.id },
      data: {
        passwordHash: funcHash,
        role: "FUNCIONARIO",
        active: true,
      },
    });
  }

  const preservedUserIds = [higorUser.id, demoAdmin.id, demoFunc.id];
  const summary: Record<string, number> = {};

  const safeDelete = async (name: string, fn: () => Promise<{ count: number }>) => {
    try {
      const res = await fn();
      summary[name] = res.count;
    } catch (e: any) {
      summary[name] = 0;
      console.warn(`[Reset DB] Tabela ${name} ignorada ou vazia:`, e?.message);
    }
  };

  // 4. Limpar dados operacionais e transacionais em ordem reversa de chave estrangeira
  await safeDelete("invoiceItem", () => prisma.invoiceItem.deleteMany());
  await safeDelete("invoice", () => prisma.invoice.deleteMany());
  await safeDelete("contract", () => prisma.contract.deleteMany());

  await safeDelete("productionOrderItem", () => prisma.productionOrderItem.deleteMany());
  await safeDelete("productRecipeItem", () => prisma.productRecipeItem.deleteMany());
  await safeDelete("productionOrder", () => prisma.productionOrder.deleteMany());
  await safeDelete("productionMachine", () => prisma.productionMachine.deleteMany());

  await safeDelete("goodsReceiptItem", () => prisma.goodsReceiptItem.deleteMany());
  await safeDelete("goodsReceipt", () => prisma.goodsReceipt.deleteMany());
  await safeDelete("purchaseItem", () => prisma.purchaseItem.deleteMany());
  await safeDelete("purchase", () => prisma.purchase.deleteMany());

  await safeDelete("serviceOrderItem", () => prisma.serviceOrderItem.deleteMany());
  await safeDelete("serviceOrder", () => prisma.serviceOrder.deleteMany());
  await safeDelete("saleItem", () => prisma.saleItem.deleteMany());
  await safeDelete("sale", () => prisma.sale.deleteMany());

  await safeDelete("stockMovement", () => prisma.stockMovement.deleteMany());
  await safeDelete("productStockLocation", () => prisma.productStockLocation.deleteMany());
  await safeDelete("stockLocation", () => prisma.stockLocation.deleteMany());
  await safeDelete("product", () => prisma.product.deleteMany());

  await safeDelete("financialEntry", () => prisma.financialEntry.deleteMany());
  await safeDelete("cashSession", () => prisma.cashSession.deleteMany());
  await safeDelete("bankAccount", () => prisma.bankAccount.deleteMany());

  await safeDelete("employeePayrollEvent", () => prisma.employeePayrollEvent.deleteMany());
  await safeDelete("employeeLeave", () => prisma.employeeLeave.deleteMany());
  await safeDelete("employeeSafetyRecord", () => prisma.employeeSafetyRecord.deleteMany());
  await safeDelete("timeClockLog", () => prisma.timeClockLog.deleteMany());
  await safeDelete("timeClockMachine", () => prisma.timeClockMachine.deleteMany());
  await safeDelete("employee", () => prisma.employee.deleteMany());

  await safeDelete("client", () => prisma.client.deleteMany());
  await safeDelete("supplier", () => prisma.supplier.deleteMany());
  await safeDelete("itTicket", () => (prisma as any).itTicket.deleteMany());

  // Tabelas dinâmicas auxiliares (conciliação OFX, notificações)
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "_OfxReconciliationLog"`);
  } catch {}
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "SystemNotification"`);
  } catch {}

  // Limpar logs antigos de auditoria
  await safeDelete("auditLog", () => prisma.auditLog.deleteMany());

  // 5. Apagar qualquer outro usuário que não seja Higor ou os acessos rápidos
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      id: { notIn: preservedUserIds },
    },
  });
  summary["usersDeleted"] = deletedUsers.count;

  // 6. Recriar perfil limpo para o funcionário de demonstração
  try {
    await prisma.employee.create({
      data: {
        userId: demoFunc.id,
        name: demoFunc.name,
        email: demoFunc.email,
        document: "000.000.000-00",
        position: "Assistente Administrativo",
        department: "Comercial",
        salary: 2800,
        active: true,
        hireDate: new Date(),
      },
    });
  } catch {}

  // 7. Registrar auditoria oficial da limpeza
  await prisma.auditLog.create({
    data: {
      userId: higorUser.id,
      userName: higorUser.name,
      module: "SISTEMA",
      action: "RESET_BANCO",
      details: `Limpeza geral do banco executada. Preservados login do administrador (${higorUser.name} <${higorUser.email}>) e acessos de demonstração (${demoAdmin.email} e ${demoFunc.email}).`,
    },
  });

  return {
    preservedUsers: [
      { id: higorUser.id, name: higorUser.name, email: higorUser.email, role: higorUser.role },
      { id: demoAdmin.id, name: demoAdmin.name, email: demoAdmin.email, role: demoAdmin.role },
      { id: demoFunc.id, name: demoFunc.name, email: demoFunc.email, role: demoFunc.role },
    ],
    summary,
  };
}
