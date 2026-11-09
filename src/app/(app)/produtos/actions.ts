"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { bool, intOrNull, num, reqStr, str, toFormError, ValidationError, type FormState } from "@/lib/form";

export async function saveProduct(id: number | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireUser();
  try {
    const data = {
      sku: reqStr(fd, "sku", "Código (SKU)").toUpperCase(),
      name: reqStr(fd, "name", "Nome"),
      description: str(fd, "description"),
      category: str(fd, "category"),
      unit: str(fd, "unit") ?? "UN",
      costPrice: num(fd, "costPrice"),
      salePrice: num(fd, "salePrice"),
      minStock: num(fd, "minStock"),
      supplierId: intOrNull(fd, "supplierId"),
      active: bool(fd, "active"),
    };
    if (data.costPrice < 0 || data.salePrice < 0) throw new ValidationError("Preços não podem ser negativos.");

    if (id) {
      await prisma.product.update({ where: { id }, data });
    } else {
      const initialStock = num(fd, "stock");
      if (initialStock < 0) throw new ValidationError("Estoque inicial não pode ser negativo.");
      await prisma.product.create({
        data: {
          ...data,
          stock: initialStock,
          movements:
            initialStock > 0
              ? { create: { type: "ENTRADA", quantity: initialStock, reason: "Estoque inicial", userId: session.userId } }
              : undefined,
        },
      });
    }
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/produtos");
  redirect("/produtos?ok=" + encodeURIComponent("Produto salvo com sucesso."));
}

export async function deleteProduct(id: number) {
  await requireUser();
  const used =
    (await prisma.saleItem.count({ where: { productId: id } })) +
    (await prisma.purchaseItem.count({ where: { productId: id } }));
  let msg: string;
  if (used > 0) {
    await prisma.product.update({ where: { id }, data: { active: false } });
    msg = "Produto possui movimentações comerciais e foi apenas inativado.";
  } else {
    await prisma.product.delete({ where: { id } });
    msg = "Produto excluído.";
  }
  revalidatePath("/produtos");
  redirect("/produtos?ok=" + encodeURIComponent(msg));
}
