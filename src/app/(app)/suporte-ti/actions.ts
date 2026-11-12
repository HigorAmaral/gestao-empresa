"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { createItTicket, createItAsset, deleteItAsset } from "@/lib/it-tickets";
import { ensureStockLocationTables } from "@/lib/stock-location";

export async function updateTicketStatusAction(fd: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Não autorizado.");

  await ensureStockLocationTables();

  const id = Number(fd.get("id"));
  const status = String(fd.get("status") || "EM_ATENDIMENTO");
  const solutionNotes = String(fd.get("solutionNotes") || "").trim();
  const assignedTo = String(fd.get("assignedTo") || session.name).trim();

  const data: any = {
    status,
    assignedTo: assignedTo || session.name,
    solutionNotes: solutionNotes || null,
  };

  if (status === "RESOLVIDO") {
    data.resolvedAt = new Date();
  }

  const updated = await (prisma as any).itTicket.update({
    where: { id },
    data,
  });

  await logAudit(
    session,
    "TI",
    "EDITAR",
    `Atualizou chamado ${updated.ticketNumber} para status ${status}`,
    id
  );

  revalidatePath("/suporte-ti");
  return { success: true };
}

export async function createInternalTicketAction(fd: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Não autorizado.");

  await ensureStockLocationTables();

  const requesterName = String(fd.get("requesterName") || session.name).trim();
  const requesterEmail = String(fd.get("requesterEmail") || session.email).trim();
  const requesterPhone = String(fd.get("requesterPhone") || "").trim();
  const department = String(fd.get("department") || "TI").trim();
  const category = String(fd.get("category") || "OUTRO");
  const priority = String(fd.get("priority") || "NORMAL");
  const title = String(fd.get("title") || "").trim();
  const description = String(fd.get("description") || "").trim();

  const ticket = await createItTicket({
    requesterName,
    requesterEmail,
    requesterPhone,
    department,
    category,
    priority,
    title,
    description,
  });

  await logAudit(
    session,
    "TI",
    "CRIAR",
    `Abriu chamado interno ${ticket.ticketNumber}: ${title}`,
    ticket.id
  );

  revalidatePath("/suporte-ti");
  return { success: true, ticketNumber: ticket.ticketNumber };
}

export async function deleteTicketAction(fd: FormData) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    throw new Error("Apenas administradores podem excluir chamados de TI.");
  }

  await ensureStockLocationTables();

  const id = Number(fd.get("id"));
  const deleted = await (prisma as any).itTicket.delete({
    where: { id },
  });

  await logAudit(
    session,
    "TI",
    "EXCLUIR",
    `Excluiu chamado ${deleted.ticketNumber}`,
    id
  );

  revalidatePath("/suporte-ti");
  return { success: true };
}

export async function createAssetAction(fd: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Não autorizado.");

  const assetTag = String(fd.get("assetTag") || "").trim();
  const name = String(fd.get("name") || "").trim();
  const category = String(fd.get("category") || "NOTEBOOK");
  const serialNumber = String(fd.get("serialNumber") || "").trim();
  const assignedUser = String(fd.get("assignedUser") || "").trim();
  const department = String(fd.get("department") || "").trim();
  const status = String(fd.get("status") || "EM_USO");
  const specifications = String(fd.get("specifications") || "").trim();
  const notes = String(fd.get("notes") || "").trim();

  const asset = await createItAsset({
    assetTag,
    name,
    category,
    serialNumber,
    assignedUser,
    department,
    status,
    specifications,
    notes,
  });

  await logAudit(
    session,
    "TI",
    "CRIAR",
    `Cadastrou ativo de TI ${asset.assetTag} (${asset.name})`,
    asset.id
  );

  revalidatePath("/suporte-ti");
  return { success: true };
}

export async function deleteAssetAction(fd: FormData) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    throw new Error("Apenas administradores podem excluir ativos de TI.");
  }

  const id = Number(fd.get("id"));
  const asset = await deleteItAsset(id);

  await logAudit(
    session,
    "TI",
    "EXCLUIR",
    `Excluiu ativo de TI ${asset.assetTag} (${asset.name})`,
    id
  );

  revalidatePath("/suporte-ti");
  return { success: true };
}
