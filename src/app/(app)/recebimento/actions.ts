"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { intOrNull, str, toFormError, ValidationError, type FormState } from "@/lib/form";
import { ensureStockLocationTables } from "@/lib/stock-location";

export type ReceiptItemInput = {
  productId: number;
  quantity: number;
  unitCost: number;
  locationId?: number | null;
  batch?: string | null;
  notes?: string | null;
};

function revalidateAll() {
  for (const p of ["/recebimento", "/estoque", "/estoque/enderecamento", "/produtos", "/compras", "/"]) {
    revalidatePath(p);
  }
}

export async function createGoodsReceipt(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireUser();
  await ensureStockLocationTables();

  let receiptId: number;

  try {
    const invoiceNumber = str(fd, "invoiceNumber");
    const notes = str(fd, "notes");
    const supplierId = intOrNull(fd, "supplierId");
    const purchaseId = intOrNull(fd, "purchaseId");

    let items: ReceiptItemInput[] = [];
    try {
      items = JSON.parse(String(fd.get("items") ?? "[]"));
    } catch {
      throw new ValidationError("Formato de itens inválido.");
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError("Adicione ao menos um item / matéria-prima no recebimento.");
    }

    // Valida cada item
    for (const item of items) {
      if (!item.productId || Number(item.productId) <= 0) {
        throw new ValidationError("Selecione um produto válido para todos os itens.");
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        throw new ValidationError("A quantidade de cada item deve ser maior que zero.");
      }
    }

    // Gera código sequencial amigável: REC-2026-0001
    const year = new Date().getFullYear();
    const countThisYear = await prisma.goodsReceipt.count({
      where: { code: { startsWith: `REC-${year}-` } },
    });
    const code = `REC-${year}-${String(countThisYear + 1).padStart(4, "0")}`;

    const created = await prisma.$transaction(async (tx) => {
      // 1. Cria o registro de recebimento
      const receipt = await tx.goodsReceipt.create({
        data: {
          code,
          invoiceNumber: invoiceNumber || null,
          supplierId: supplierId || null,
          purchaseId: purchaseId || null,
          notes: notes || null,
          userId: session.userId,
          status: "RECEBIDO",
          receivedAt: new Date(),
        },
      });

      // 2. Insere os itens, atualiza o estoque geral e atualiza o endereçamento de estoque
      for (const item of items) {
        const prodId = Number(item.productId);
        const qty = Number(item.quantity);
        const cost = Number(item.unitCost) || 0;
        const locId = item.locationId ? Number(item.locationId) : null;
        const batch = item.batch?.trim() || null;
        const itemNotes = item.notes?.trim() || null;

        await tx.goodsReceiptItem.create({
          data: {
            receiptId: receipt.id,
            productId: prodId,
            quantity: qty,
            unitCost: cost,
            locationId: locId,
            batch,
            notes: itemNotes,
          },
        });

        // Atualiza estoque geral do produto e preço de custo se informado
        await tx.product.update({
          where: { id: prodId },
          data: {
            stock: { increment: qty },
            ...(cost > 0 ? { costPrice: cost } : {}),
          },
        });

        // Cria movimentação de estoque
        await tx.stockMovement.create({
          data: {
            productId: prodId,
            type: "ENTRADA",
            quantity: qty,
            reason: `Recebimento ${code}${invoiceNumber ? ` (NF: ${invoiceNumber})` : ""}`,
            userId: session.userId,
          },
        });

        // Se um endereço de estoque foi informado, aloca os itens diretamente nele
        if (locId) {
          const existingLoc = await tx.productStockLocation.findUnique({
            where: {
              productId_locationId: {
                productId: prodId,
                locationId: locId,
              },
            },
          });

          if (existingLoc) {
            await tx.productStockLocation.update({
              where: { id: existingLoc.id },
              data: {
                quantity: { increment: qty },
                notes: batch ? `Lote: ${batch}` : existingLoc.notes,
              },
            });
          } else {
            await tx.productStockLocation.create({
              data: {
                productId: prodId,
                locationId: locId,
                quantity: qty,
                notes: batch ? `Lote: ${batch}` : null,
              },
            });
          }
        }
      }

      // Se veio de um pedido de compra, marca a compra como recebida
      if (purchaseId) {
        await tx.purchase.update({
          where: { id: purchaseId },
          data: {
            status: "RECEBIDA",
            receivedAt: new Date(),
          },
        });
      }

      return receipt;
    });

    receiptId = created.id;
    await logAudit(
      session,
      "RECEBIMENTO",
      "CRIAR",
      `Recebimento ${code} registrado com ${items.length} item(ns). NF: ${invoiceNumber || "S/N"}`,
      receiptId
    );
  } catch (err) {
    return toFormError(err);
  }

  revalidateAll();
  redirect(`/recebimento?ok=${encodeURIComponent("Recebimento registrado e estoque/endereçamento atualizados com sucesso!")}`);
}

export async function cancelGoodsReceipt(id: number) {
  const session = await requireUser();
  await ensureStockLocationTables();

  try {
    await prisma.$transaction(async (tx) => {
      const receipt = await tx.goodsReceipt.findUnique({
        where: { id },
        include: {
          items: {
            include: { product: true },
          },
        },
      });

      if (!receipt) throw new ValidationError("Recebimento não encontrado.");
      if (receipt.status === "CANCELADO") throw new ValidationError("Este recebimento já foi cancelado.");

      // Verifica se há saldo suficiente para estornar
      for (const item of receipt.items) {
        if (item.product.stock < item.quantity) {
          throw new ValidationError(
            `Não é possível cancelar: produto "${item.product.name}" possui apenas ${item.product.stock} em estoque (necessário estornar ${item.quantity}).`
          );
        }
      }

      // Estorna estoque, movimentações e endereçamento
      for (const item of receipt.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "SAIDA",
            quantity: item.quantity,
            reason: `Estorno do Recebimento ${receipt.code}`,
            userId: session.userId,
          },
        });

        if (item.locationId) {
          const locItem = await tx.productStockLocation.findUnique({
            where: {
              productId_locationId: {
                productId: item.productId,
                locationId: item.locationId,
              },
            },
          });

          if (locItem) {
            const newQty = Math.max(0, locItem.quantity - item.quantity);
            if (newQty === 0) {
              await tx.productStockLocation.delete({ where: { id: locItem.id } });
            } else {
              await tx.productStockLocation.update({
                where: { id: locItem.id },
                data: { quantity: newQty },
              });
            }
          }
        }
      }

      // Se havia compra vinculada, reverte para PENDENTE
      if (receipt.purchaseId) {
        await tx.purchase.update({
          where: { id: receipt.purchaseId },
          data: { status: "PENDENTE", receivedAt: null },
        });
      }

      await tx.goodsReceipt.update({
        where: { id },
        data: { status: "CANCELADO" },
      });
    });

    await logAudit(session, "RECEBIMENTO", "CANCELAR", `Recebimento #${id} cancelado e estoque estornado.`, id);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro ao cancelar recebimento.";
    redirect(`/recebimento?erro=${encodeURIComponent(errorMsg)}`);
  }

  revalidateAll();
  redirect(`/recebimento?ok=${encodeURIComponent("Recebimento cancelado e estoque estornado com sucesso.")}`);
}
