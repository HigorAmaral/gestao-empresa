"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function requestVacationAction(formData: FormData) {
  const user = await requireUser();

  const startDateStr = formData.get("startDate") as string;
  const days = Number(formData.get("days")) || 30;
  const notes = (formData.get("notes") as string)?.trim() || "";

  // Busca estritamente o colaborador do usuário logado (impede forjar employeeId de outro colega)
  const employee = await prisma.employee.findFirst({
    where: {
      active: true,
      OR: [
        { userId: user.userId },
        { email: user.email },
      ],
    },
  });

  if (!employee) {
    throw new Error("Nenhum registro de colaborador vinculado ao seu usuário.");
  }

  if (!startDateStr || days < 5 || days > 30) {
    throw new Error("Informe a data de início e quantidade válida de dias (entre 5 e 30 dias).");
  }

  const startDate = new Date(startDateStr);
  const returnDate = new Date(startDate.getTime() + days * 86400000);

  const leave = await prisma.employeeLeave.create({
    data: {
      employeeId: employee.id,
      type: "FERIAS",
      startDate,
      endDate: returnDate,
      days,
      status: "PROGRAMADA",
      notes: notes
        ? `[SOLICITACAO_PORTAL]: ${notes}`
        : "[SOLICITACAO_PORTAL]: Solicitado via Portal do Colaborador",
    },
  });

  await logAudit(user, "RH", "SOLICITAR_FERIAS", `Colaborador solicitou ${days} dias de férias`, leave.id);

  revalidatePath("/portal-colaborador");
  revalidatePath("/funcionarios/ferias");
}
