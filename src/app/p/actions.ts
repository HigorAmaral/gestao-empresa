"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { str } from "@/lib/form";
import { round2 } from "@/lib/items";
import { verifyPublicToken } from "@/lib/public-token";
import { ensureStockLocationTables } from "@/lib/stock-location";

export async function approvePublicSaleAction(saleId: number, token: string, fd: FormData) {
  await ensureStockLocationTables();
  if (!verifyPublicToken("venda", saleId, token)) {
    redirect(`/p/venda/${saleId}?t=${token}&erro=${encodeURIComponent("Link de aprovação inválido.")}`);
  }

  const clientNotes = str(fd, "clientNotes");

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { client: true, items: { include: { product: true } } },
  });
  if (!sale) {
    redirect(`/p/venda/${saleId}?t=${token}&erro=${encodeURIComponent("Orçamento não encontrado.")}`);
  }

  if (sale.status === "ORCAMENTO") {
    // Verifica se há estoque para confirmar automaticamente; se sim, já confirma; caso contrário marca approvedAt
    const hasEnoughStock = sale.items.every((item) => item.product.stock >= item.quantity);

    await prisma.$transaction(async (tx) => {
      if (hasEnoughStock) {
        for (const item of sale.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: "SAIDA",
              quantity: item.quantity,
              reason: `Aprovação online do orçamento #${sale.id}`,
            },
          });
        }

        const n = Math.max(1, sale.installments || 1);
        const baseAmt = Math.floor((sale.total / n) * 100) / 100;
        for (let i = 0; i < n; i++) {
          const amt = i === n - 1 ? round2(sale.total - baseAmt * (n - 1)) : baseAmt;
          const due = new Date();
          due.setUTCMonth(due.getUTCMonth() + i);
          await tx.financialEntry.create({
            data: {
              type: "RECEITA",
              description: `Venda #${sale.id}${n > 1 ? ` (${i + 1}/${n})` : ""}${sale.client ? ` — ${sale.client.name}` : ""}`,
              category: "Vendas",
              amount: amt,
              dueDate: due,
              saleId: sale.id,
            },
          });
        }

        await tx.sale.update({
          where: { id: sale.id },
          data: {
            status: "CONFIRMADA",
            approvedAt: new Date(),
            clientNotes: clientNotes || null,
          },
        });
      } else {
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            approvedAt: new Date(),
            clientNotes: clientNotes || null,
          },
        });
      }
    });

    await logAudit(
      { name: sale.client?.name ?? "Cliente Externo (Link Público)" },
      "VENDAS",
      "CONFIRMAR",
      `Cliente aprovou online o orçamento #${sale.id}${clientNotes ? ` — Obs: ${clientNotes}` : ""}`,
      sale.id,
    );
  }

  revalidatePath(`/vendas/${saleId}`);
  revalidatePath("/vendas");
  revalidatePath(`/p/venda/${saleId}`);
  redirect(`/p/venda/${saleId}?t=${token}&ok=1`);
}

export async function approvePublicOsAction(osId: number, token: string, fd: FormData) {
  await ensureStockLocationTables();
  if (!verifyPublicToken("os", osId, token)) {
    redirect(`/p/os/${osId}?t=${token}&erro=${encodeURIComponent("Link de aprovação inválido.")}`);
  }

  const clientNotes = str(fd, "clientNotes");
  const os = await prisma.serviceOrder.findUnique({
    where: { id: osId },
    include: { client: true },
  });
  if (!os) {
    redirect(`/p/os/${osId}?t=${token}&erro=${encodeURIComponent("Ordem de serviço não encontrada.")}`);
  }

  await prisma.serviceOrder.update({
    where: { id: osId },
    data: {
      approvedAt: new Date(),
      clientNotes: clientNotes || null,
      ...(os.status === "ABERTA" ? { status: "EM_ANDAMENTO" } : {}),
    },
  });

  await logAudit(
    { name: os.client?.name ?? "Cliente Externo (Link Público)" },
    "OS",
    "EDITAR",
    `Cliente aprovou/autorizou online a OS #${os.id}${clientNotes ? ` — Obs: ${clientNotes}` : ""}`,
    os.id,
  );

  revalidatePath(`/os/${osId}`);
  revalidatePath("/os");
  revalidatePath(`/p/os/${osId}`);
  redirect(`/p/os/${osId}?t=${token}&ok=1`);
}
