"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { reqStr, str, toFormError, type FormState } from "@/lib/form";

export async function saveCompanySettings(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireAdmin();
  try {
    const data = {
      name: reqStr(fd, "name", "Razão Social"),
      tradeName: str(fd, "tradeName"),
      document: str(fd, "document"),
      stateRegistration: str(fd, "stateRegistration"),
      email: str(fd, "email"),
      phone: str(fd, "phone"),
      website: str(fd, "website"),
      address: str(fd, "address"),
      city: str(fd, "city"),
      state: str(fd, "state"),
      zipCode: str(fd, "zipCode"),
      receiptFooter: str(fd, "receiptFooter"),
    };
    await prisma.companySettings.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data },
    });
    await logAudit(session, "CONFIG", "EDITAR", `Atualizou dados cadastrais da empresa (${data.name})`, 1);
  } catch (e) {
    return toFormError(e);
  }
  revalidateTag("company-settings", "max");
  revalidatePath("/", "layout");
  revalidatePath("/configuracoes");
  return { success: "Configurações da empresa atualizadas com sucesso." };
}
