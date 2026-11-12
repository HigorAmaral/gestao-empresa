"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { ensureStockLocationTables } from "@/lib/stock-location";

export type InventoryAdjustmentItem = {
  productId: number;
  countedStock: number;
};

export async function applyInventoryBatchAction(
  items: InventoryAdjustmentItem[],
  reasonNote?: string,
): Promise<{ ok?: boolean; adjustedCount?: number; message?: string; error?: string }> {
  const session = await requireUser();
  await ensureStockLocationTables();

  if (!items || items.length === 0) {
    return { error: "Informe a contagem física de pelo menos 1 produto." };
  }

  try {
    let adjustedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (item.countedStock < 0 || isNaN(item.countedStock)) continue;

        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        if (!prod) continue;

        const diff = Number((item.countedStock - prod.stock).toFixed(4));
        if (Math.abs(diff) < 0.0001) continue;

        await tx.product.update({
          where: { id: prod.id },
          data: { stock: item.countedStock },
        });

        await tx.stockMovement.create({
          data: {
            productId: prod.id,
            type: "AJUSTE",
            quantity: item.countedStock,
            reason: `Inventário Físico: era ${prod.stock} → contado ${item.countedStock} (${diff > 0 ? `+${diff}` : diff})${reasonNote ? ` — ${reasonNote}` : ""}`,
            userId: session.userId,
          },
        });

        adjustedCount++;
      }
    });

    if (adjustedCount === 0) {
      return { ok: true, adjustedCount: 0, message: "Nenhuma divergência entre a contagem física e o saldo do sistema." };
    }

    const msg = `Balanço de Inventário aplicado: ${adjustedCount} produto(s) tiveram o estoque ajustado.`;
    await logAudit(session, "ESTOQUE", "AJUSTE", msg);

    for (const p of ["/estoque/inventario", "/estoque", "/produtos", "/"]) {
      revalidatePath(p);
    }

    return { ok: true, adjustedCount, message: msg };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao processar ajuste de inventário em lote." };
  }
}
