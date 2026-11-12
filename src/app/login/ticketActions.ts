"use server";

import { createItTicket } from "@/lib/it-tickets";

export interface TicketFormState {
  error?: string;
  success?: boolean;
  ticketNumber?: string;
}

export async function openPublicTicketAction(
  _prev: TicketFormState | undefined,
  fd: FormData
): Promise<TicketFormState> {
  try {
    const requesterName = String(fd.get("requesterName") ?? "").trim();
    const requesterEmail = String(fd.get("requesterEmail") ?? "").trim();
    const requesterPhone = String(fd.get("requesterPhone") ?? "").trim();
    const department = String(fd.get("department") ?? "").trim();
    const category = String(fd.get("category") ?? "OUTRO");
    const priority = String(fd.get("priority") ?? "NORMAL");
    const title = String(fd.get("title") ?? "").trim();
    const description = String(fd.get("description") ?? "").trim();

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

    return {
      success: true,
      ticketNumber: ticket.ticketNumber,
    };
  } catch (e: any) {
    return {
      error: e?.message || "Erro ao registrar chamado de TI. Tente novamente.",
    };
  }
}
