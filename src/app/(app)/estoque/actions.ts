"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { intOrNull, num, str, toFormError, ValidationError, type FormState } from "@/lib/form";

/** Movimentação manual: ENTRADA soma, SAIDA subtrai, AJUSTE define o saldo exato (inventário). */
export async function createMovement(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireUser();
  try {
    const productId = intOrNull(fd, "productId");
    const type = str(fd, "type");
    const quantity = num(fd, "quantity", NaN);
    const reason = str(fd, "reason");
    if (!productId) throw new ValidationError("Selecione um produto.");
    if (!type || !["ENTRADA", "SAIDA", "AJUSTE"].includes(type)) throw new ValidationError("Tipo inválido.");
    if (!Number.isFinite(quantity) || quantity < 0 || (type !== "AJUSTE" && quantity === 0))
      throw new ValidationError("Informe uma quantidade válida.");

    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new ValidationError("Produto não encontrado.");

      let newStock = product.stock;
      let delta = quantity;
      if (type === "ENTRADA") newStock += quantity;
      if (type === "SAIDA") {
        if (quantity > product.stock) throw new ValidationError(`Estoque insuficiente (disponível: ${product.stock}).`);
        newStock -= quantity;
      }
      if (type === "AJUSTE") {
        delta = quantity - product.stock;
        newStock = quantity;
      }

      await tx.product.update({ where: { id: productId }, data: { stock: newStock } });
      await tx.stockMovement.create({
        data: {
          productId,
          type,
          quantity: type === "AJUSTE" ? delta : quantity,
          reason: reason ?? (type === "AJUSTE" ? `Inventário: saldo ajustado para ${quantity}` : null),
          userId: session.userId,
        },
      });
    });
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/estoque");
  revalidatePath("/produtos");
  return { success: "Movimentação registrada com sucesso." };
}
