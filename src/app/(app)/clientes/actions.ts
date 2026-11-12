"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { toFormError, type FormState } from "@/lib/form";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { clientPartyData } from "@/components/PartyFields";

export async function saveClient(id: number | null, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  await ensureStockLocationTables();
  try {
    const data = clientPartyData(fd);
    if (id) await prisma.client.update({ where: { id }, data });
    else await prisma.client.create({ data });
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/clientes");
  redirect("/clientes?ok=" + encodeURIComponent("Cliente salvo com sucesso."));
}

export async function deleteClient(id: number) {
  await requireUser();
  const sales = await prisma.sale.count({ where: { clientId: id } });
  let msg: string;
  if (sales > 0) {
    await prisma.client.update({ where: { id }, data: { active: false } });
    msg = "Cliente possui vendas e foi apenas inativado.";
  } else {
    await prisma.client.delete({ where: { id } });
    msg = "Cliente excluído.";
  }
  revalidatePath("/clientes");
  redirect("/clientes?ok=" + encodeURIComponent(msg));
}
