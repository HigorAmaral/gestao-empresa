"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { toFormError, type FormState } from "@/lib/form";
import { partyData } from "@/components/PartyFields";

export async function saveSupplier(id: number | null, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  try {
    const data = partyData(fd);
    if (id) await prisma.supplier.update({ where: { id }, data });
    else await prisma.supplier.create({ data });
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/fornecedores");
  redirect("/fornecedores?ok=" + encodeURIComponent("Fornecedor salvo com sucesso."));
}

export async function deleteSupplier(id: number) {
  await requireUser();
  const purchases = await prisma.purchase.count({ where: { supplierId: id } });
  let msg: string;
  if (purchases > 0) {
    await prisma.supplier.update({ where: { id }, data: { active: false } });
    msg = "Fornecedor possui compras e foi apenas inativado.";
  } else {
    await prisma.supplier.delete({ where: { id } });
    msg = "Fornecedor excluído.";
  }
  revalidatePath("/fornecedores");
  redirect("/fornecedores?ok=" + encodeURIComponent(msg));
}
