"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { round2 } from "@/lib/items";
import { ensureStockLocationTables } from "@/lib/stock-location";

export async function openCashSessionAction(openingBalance: number, notes?: string) {
  const session = await requireUser();
  await ensureStockLocationTables();

  const existing = await prisma.cashSession.findFirst({
    where: { status: "ABERTO" },
  });
  if (existing) {
    return { error: "Já existe um caixa aberto no momento." };
  }

  const created = await prisma.cashSession.create({
    data: {
      userId: session.userId,
      userName: session.name,
      status: "ABERTO",
      openingBalance: Math.max(0, round2(openingBalance)),
      notes: notes || null,
    },
  });

  await logAudit(session, "VENDAS", "CRIAR", `Abriu o caixa PDV #${created.id} com saldo inicial R$ ${openingBalance.toFixed(2)}`, created.id);
  revalidatePath("/pdv");
  return { ok: true, sessionId: created.id };
}

export async function cashMovementAction(type: "SANGRIA" | "SUPRIMENTO", amount: number, reason: string) {
  const session = await requireUser();
  await ensureStockLocationTables();

  if (amount <= 0) return { error: "Informe um valor maior que zero." };

  const active = await prisma.cashSession.findFirst({
    where: { status: "ABERTO" },
    orderBy: { openedAt: "desc" },
  });
  if (!active) return { error: "Abra o caixa antes de registrar sangria ou suprimento." };

  const updatedNotes = [
    active.notes,
    `[${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}] ${type}: R$ ${amount.toFixed(2)} (${reason || "Sem observação"})`,
  ]
    .filter(Boolean)
    .join(" | ");

  await prisma.cashSession.update({
    where: { id: active.id },
    data: {
      ...(type === "SANGRIA"
        ? { withdrawals: { increment: round2(amount) } }
        : { supplies: { increment: round2(amount) } }),
      notes: updatedNotes,
    },
  });

  // Registra também no financeiro se for sangria/despesa operacional ou mantém histórico na auditoria
  await logAudit(session, "VENDAS", "EDITAR", `PDV ${type} no caixa #${active.id}: R$ ${amount.toFixed(2)} — ${reason}`, active.id);
  revalidatePath("/pdv");
  return { ok: true };
}

export async function closeCashSessionAction(closingBalance: number, notes?: string) {
  const session = await requireUser();
  await ensureStockLocationTables();

  const active = await prisma.cashSession.findFirst({
    where: { status: "ABERTO" },
    orderBy: { openedAt: "desc" },
  });
  if (!active) return { error: "Nenhum caixa aberto encontrado." };

  const finalNotes = [active.notes, notes ? `Fechamento: ${notes}` : null].filter(Boolean).join(" | ");

  await prisma.cashSession.update({
    where: { id: active.id },
    data: {
      status: "FECHADO",
      closedAt: new Date(),
      closingBalance: round2(closingBalance),
      notes: finalNotes || null,
    },
  });

  await logAudit(session, "VENDAS", "CONFIRMAR", `Fechou o caixa PDV #${active.id} com valor conferido R$ ${closingBalance.toFixed(2)}`, active.id);
  revalidatePath("/pdv");
  return { ok: true };
}

export type PdvSaleInput = {
  clientId: number | null;
  items: { productId: number; quantity: number; unitPrice: number }[];
  discount: number;
  paymentMethod: string;
  splitDetails?: { method1: string; amount1: number; method2: string; amount2: number } | null;
  notes?: string;
};

export async function completePdvSaleAction(input: PdvSaleInput): Promise<{ ok?: boolean; saleId?: number; error?: string }> {
  const session = await requireUser();
  await ensureStockLocationTables();

  if (!input.items || input.items.length === 0) {
    return { error: "Adicione pelo menos 1 produto ao carrinho." };
  }

  try {
    let createdSaleId = 0;

    await prisma.$transaction(async (tx) => {
      const subtotal = round2(input.items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0));
      const discount = Math.max(0, Math.min(subtotal, round2(input.discount || 0)));
      const total = round2(subtotal - discount);

      // Verifica estoque e baixa
      for (const item of input.items) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        if (!prod) throw new Error(`Produto #${item.productId} não encontrado.`);
        if (prod.stock < item.quantity) {
          throw new Error(`Estoque insuficiente para "${prod.name}" (disponível: ${prod.stock} ${prod.unit}).`);
        }
        await tx.product.update({
          where: { id: prod.id },
          data: { stock: { decrement: item.quantity } },
        });
      }

      const paymentLabel = input.splitDetails
        ? `${input.splitDetails.method1} (R$ ${input.splitDetails.amount1.toFixed(2)}) + ${input.splitDetails.method2} (R$ ${input.splitDetails.amount2.toFixed(2)})`
        : input.paymentMethod;

      const sale = await tx.sale.create({
        data: {
          clientId: input.clientId || null,
          userId: session.userId,
          date: new Date(),
          status: "CONFIRMADA",
          paymentMethod: paymentLabel,
          installments: 1,
          subtotal,
          discount,
          total,
          notes: input.notes ? `[PDV] ${input.notes}` : "[Venda Rápida PDV]",
          items: {
            create: input.items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              total: round2(i.quantity * i.unitPrice),
            })),
          },
        },
      });
      createdSaleId = sale.id;

      // Movimentações de estoque
      for (const item of input.items) {
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "SAIDA",
            quantity: item.quantity,
            reason: `Venda PDV #${sale.id}`,
            userId: session.userId,
          },
        });
      }

      // Conta caixa padrão (se existir)
      const defaultBank = await tx.bankAccount.findFirst({
        where: { active: true },
        orderBy: { id: "asc" },
      });

      // Lançamento financeiro (já pago pois é venda de balcão PDV)
      await tx.financialEntry.create({
        data: {
          type: "RECEITA",
          description: `Venda PDV #${sale.id} (${paymentLabel})`,
          category: "Vendas PDV",
          amount: total,
          dueDate: new Date(),
          paidAt: new Date(),
          status: "PAGO",
          saleId: sale.id,
          bankAccountId: defaultBank?.id ?? null,
        },
      });

      // Atualiza sessão de caixa aberta, se houver
      const activeCash = await tx.cashSession.findFirst({
        where: { status: "ABERTO" },
        orderBy: { openedAt: "desc" },
      });

      if (activeCash) {
        let addCash = 0;
        let addPix = 0;
        let addCard = 0;
        let addOther = 0;

        const classify = (method: string, val: number) => {
          const m = method.toUpperCase();
          if (m.includes("DINHEIRO")) addCash += val;
          else if (m.includes("PIX")) addPix += val;
          else if (m.includes("CART")) addCard += val;
          else addOther += val;
        };

        if (input.splitDetails) {
          classify(input.splitDetails.method1, input.splitDetails.amount1);
          classify(input.splitDetails.method2, input.splitDetails.amount2);
        } else {
          classify(input.paymentMethod, total);
        }

        await tx.cashSession.update({
          where: { id: activeCash.id },
          data: {
            totalCash: { increment: round2(addCash) },
            totalPix: { increment: round2(addPix) },
            totalCard: { increment: round2(addCard) },
            totalOther: { increment: round2(addOther) },
            salesCount: { increment: 1 },
          },
        });
      }
    });

    await logAudit(session, "VENDAS", "CRIAR", `Venda PDV #${createdSaleId} concluída.`, createdSaleId);
    for (const p of ["/pdv", "/vendas", "/estoque", "/produtos", "/financeiro", "/"]) {
      revalidatePath(p);
    }
    return { ok: true, saleId: createdSaleId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao finalizar venda no PDV." };
  }
}
