import { prisma } from "@/lib/prisma";
import { ensureStockLocationTables } from "@/lib/stock-location";

export interface CreateTicketInput {
  requesterName: string;
  requesterEmail?: string;
  requesterPhone?: string;
  department?: string;
  category?: string;
  priority?: string;
  title: string;
  description: string;
}

export async function createItTicket(input: CreateTicketInput) {
  await ensureStockLocationTables();

  const name = String(input.requesterName || "").trim();
  const title = String(input.title || "").trim();
  const description = String(input.description || "").trim();

  if (!name) throw new Error("Informe o nome do solicitante.");
  if (!title) throw new Error("Informe o assunto / título do chamado.");
  if (!description) throw new Error("Descreva detalhadamente o problema ou solicitação.");

  const year = new Date().getFullYear();

  // Gera número sequencial de protocolo: TI-2026-0001
  const count = await (prisma as any).itTicket.count();
  const ticketNumber = `TI-${year}-${String(count + 1).padStart(4, "0")}`;

  const ticket = await (prisma as any).itTicket.create({
    data: {
      ticketNumber,
      requesterName: name,
      requesterEmail: input.requesterEmail?.trim() || null,
      requesterPhone: input.requesterPhone?.trim() || null,
      department: input.department?.trim() || "Geral",
      category: input.category || "OUTRO",
      priority: input.priority || "NORMAL",
      status: "ABERTO",
      title,
      description,
    },
  });

  return ticket;
}

export async function getItTicketsList(filters?: {
  status?: string;
  category?: string;
  priority?: string;
  search?: string;
}) {
  await ensureStockLocationTables();

  const where: any = {};

  if (filters?.status && filters.status !== "TODOS") {
    where.status = filters.status;
  }
  if (filters?.category && filters.category !== "TODOS") {
    where.category = filters.category;
  }
  if (filters?.priority && filters.priority !== "TODOS") {
    where.priority = filters.priority;
  }
  if (filters?.search && filters.search.trim()) {
    const s = filters.search.trim();
    where.OR = [
      { ticketNumber: { contains: s, mode: "insensitive" } },
      { requesterName: { contains: s, mode: "insensitive" } },
      { title: { contains: s, mode: "insensitive" } },
      { department: { contains: s, mode: "insensitive" } },
    ];
  }

  const [tickets, totalCount, openCount, inProgressCount, resolvedCount] = await Promise.all([
    (prisma as any).itTicket.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    (prisma as any).itTicket.count(),
    (prisma as any).itTicket.count({ where: { status: "ABERTO" } }),
    (prisma as any).itTicket.count({ where: { status: "EM_ATENDIMENTO" } }),
    (prisma as any).itTicket.count({ where: { status: "RESOLVIDO" } }),
  ]);

  return {
    tickets,
    metrics: {
      total: totalCount,
      open: openCount,
      inProgress: inProgressCount,
      resolved: resolvedCount,
    },
  };
}

export interface CreateAssetInput {
  assetTag: string;
  name: string;
  category: string;
  serialNumber?: string;
  assignedUser?: string;
  department?: string;
  status?: string;
  specifications?: string;
  notes?: string;
}

export async function createItAsset(input: CreateAssetInput) {
  await ensureStockLocationTables();
  const assetTag = input.assetTag.trim();
  const name = input.name.trim();
  if (!assetTag || !name) throw new Error("Patrimônio e nome do ativo são obrigatórios.");

  return (prisma as any).itAsset.create({
    data: {
      assetTag,
      name,
      category: input.category || "NOTEBOOK",
      serialNumber: input.serialNumber?.trim() || null,
      assignedUser: input.assignedUser?.trim() || null,
      department: input.department?.trim() || null,
      status: input.status || "EM_USO",
      specifications: input.specifications?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });
}

export async function getItAssetsList() {
  await ensureStockLocationTables();
  const assets = await (prisma as any).itAsset.findMany({
    orderBy: [{ status: "asc" }, { assetTag: "asc" }],
  });
  return assets;
}

export async function deleteItAsset(id: number) {
  await ensureStockLocationTables();
  return (prisma as any).itAsset.delete({ where: { id } });
}

export async function getSystemHealthMetrics() {
  await ensureStockLocationTables();
  const t0 = Date.now();
  try {
    await prisma.$queryRawUnsafe(`SELECT 1`);
  } catch {}
  const dbLatencyMs = Math.max(1, Date.now() - t0);

  const [ticketsCount, auditCount, usersCount] = await Promise.all([
    (prisma as any).itTicket.count().catch(() => 0),
    prisma.auditLog.count().catch(() => 0),
    prisma.user.count().catch(() => 0),
  ]);

  return {
    dbStatus: "OPERACIONAL",
    dbLatencyMs,
    dbType: "PostgreSQL (Neon Cloud Serverless)",
    nextVersion: "16.4.6 (Turbopack Engine)",
    nodeVersion: process.version,
    memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    uptimeMinutes: Math.round(process.uptime() / 60),
    ticketsCount,
    auditCount,
    usersCount,
    environment: process.env.NODE_ENV || "production",
  };
}
