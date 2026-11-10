"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { bool, intOrNull, num, reqStr, str, toFormError, ValidationError, type FormState } from "@/lib/form";
import { logAudit } from "@/lib/audit";
import { ensureStockLocationTables } from "@/lib/stock-location";

export type RecipeComponentInput = {
  componentId: number;
  quantity: number;
  notes?: string | null;
};

export async function saveProductRecipe(productId: number, _prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireUser();
  await ensureStockLocationTables();

  try {
    let items: RecipeComponentInput[] = [];
    try {
      items = JSON.parse(String(fd.get("recipeItems") ?? "[]"));
    } catch {
      throw new ValidationError("Formato da ficha técnica inválido.");
    }

    for (const item of items) {
      const compId = Number(item.componentId);
      const qty = Number(item.quantity);
      if (!compId || compId <= 0) throw new ValidationError("Selecione um insumo válido.");
      if (compId === productId) throw new ValidationError("Um produto não pode conter a si próprio como matéria-prima.");
      if (!qty || qty <= 0) throw new ValidationError("A quantidade do insumo deve ser maior que zero.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.productRecipeItem.deleteMany({ where: { productId } });
      for (const item of items) {
        await tx.productRecipeItem.create({
          data: {
            productId,
            componentId: Number(item.componentId),
            quantity: Number(item.quantity),
            notes: item.notes?.trim() || null,
          },
        });
      }
    });

    await logAudit(
      session,
      "PRODUTO",
      "FICHA_TECNICA",
      `Atualizou a ficha técnica (BOM) do produto #${productId} com ${items.length} insumo(s).`,
      productId
    );
  } catch (err) {
    return toFormError(err);
  }

  revalidatePath(`/produtos/${productId}`);
  revalidatePath("/produtos");
  revalidatePath("/producao/novo");
  return { success: "Ficha técnica salva com sucesso!" };
}

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
