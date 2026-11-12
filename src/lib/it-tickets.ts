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
