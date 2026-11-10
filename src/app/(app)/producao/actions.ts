"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { dateVal, intOrNull, num, str, toFormError, ValidationError, type FormState } from "@/lib/form";
import { ensureStockLocationTables } from "@/lib/stock-location";

export type ProductionItemInput = {
  productId: number;
  quantityRequired: number;
  locationId?: number | null;
  notes?: string | null;
};

function revalidateAll() {
  for (const p of ["/producao", "/produtos", "/estoque", "/estoque/enderecamento", "/"]) {
    revalidatePath(p);
  }
}

export async function createProductionOrder(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireUser();
  await ensureStockLocationTables();

  let orderId: number;

  try {
    const productId = intOrNull(fd, "productId");
    if (!productId) throw new ValidationError("Selecione o produto final que será fabricado.");

    const quantity = num(fd, "quantity");
    if (!quantity || quantity <= 0) {
      throw new ValidationError("A quantidade a fabricar deve ser maior que zero.");
    }

    const machine = str(fd, "machine");
    if (!machine) {
      throw new ValidationError("Informe a máquina ou posto de trabalho de destino para entrega dos materiais.");
    }

    const operatorName = str(fd, "operatorName");
    const priority = str(fd, "priority") || "NORMAL";
    const deliveryDate = dateVal(fd, "deliveryDate");
    const notes = str(fd, "notes");

    let items: ProductionItemInput[] = [];
    try {
      items = JSON.parse(String(fd.get("items") ?? "[]"));
    } catch {
      throw new ValidationError("Formato da lista de insumos inválido.");
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError("Adicione ao menos uma matéria-prima ou insumo na lista da OP.");
    }

    for (const item of items) {
      if (!item.productId || Number(item.productId) <= 0) {
        throw new ValidationError("Selecione uma matéria-prima válida para todos os insumos.");
      }
      if (!item.quantityRequired || Number(item.quantityRequired) <= 0) {
        throw new ValidationError("A quantidade necessária de cada insumo deve ser maior que zero.");
      }
    }

    // Gera código da OP: OP-2026-0001
    const year = new Date().getFullYear();
    const countThisYear = await prisma.productionOrder.count({
      where: { code: { startsWith: `OP-${year}-` } },
    });
    const code = `OP-${year}-${String(countThisYear + 1).padStart(4, "0")}`;

    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.productionOrder.create({
        data: {
          code,
          productId,
          quantity,
          machine,
          operatorName: operatorName || null,
          priority,
          status: "PLANEJADA",
          deliveryDate: deliveryDate || null,
          notes: notes || null,
          userId: session.userId,
        },
      });

      for (const item of items) {
        await tx.productionOrderItem.create({
          data: {
            productionOrderId: order.id,
            productId: Number(item.productId),
            quantityRequired: Number(item.quantityRequired),
            locationId: item.locationId ? Number(item.locationId) : null,
            notes: item.notes?.trim() || null,
          },
        });
      }

      return order;
    });

    orderId = created.id;
    await logAudit(
      session,
      "PRODUCAO",
      "CRIAR",
      `OP ${code} criada para ${quantity} un na máquina "${machine}" com ${items.length} insumos.`,
      orderId
    );
  } catch (err) {
    return toFormError(err);
  }

  revalidateAll();
  redirect(`/producao/${orderId}?ok=${encodeURIComponent("Ordem de Produção criada com sucesso! Ficha pronta para entrega na máquina.")}`);
}

export async function startProductionOrder(id: number) {
  const session = await requireUser();
  await ensureStockLocationTables();

  try {
    const order = await prisma.productionOrder.findUnique({ where: { id } });
    if (!order) throw new ValidationError("Ordem de produção não encontrada.");
    if (order.status !== "PLANEJADA") {
      throw new ValidationError("Apenas OPs com status 'Planejada' podem ser iniciadas.");
    }

    await prisma.productionOrder.update({
      where: { id },
      data: {
        status: "EM_PRODUCAO",
        startDate: new Date(),
      },
    });

    await logAudit(session, "PRODUCAO", "INICIAR", `OP ${order.code} iniciada na máquina ${order.machine}.`, id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao iniciar OP.";
    redirect(`/producao/${id}?erro=${encodeURIComponent(msg)}`);
  }

  revalidateAll();
  redirect(`/producao/${id}?ok=${encodeURIComponent("Produção iniciada na máquina!")}`);
}

export async function completeProductionOrder(id: number) {
  const session = await requireUser();
  await ensureStockLocationTables();

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.productionOrder.findUnique({
        where: { id },
        include: {
          product: true,
          items: {
            include: { product: true },
          },
        },
      });

      if (!order) throw new ValidationError("Ordem de produção não encontrada.");
      if (order.status === "CONCLUIDA") {
        throw new ValidationError("Esta ordem de produção já foi concluída.");
      }
      if (order.status === "CANCELADA") {
        throw new ValidationError("Uma OP cancelada não pode ser concluída.");
      }

      // 1. Dá baixa nas matérias-primas e insumos utilizados
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantityRequired } },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "SAIDA",
            quantity: item.quantityRequired,
            reason: `Consumo OP ${order.code} - Máquina ${order.machine}`,
            userId: session.userId,
          },
        });

        // Se havia endereço de estoque de onde foi retirado, diminui do endereço também
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
            const newQty = Math.max(0, locItem.quantity - item.quantityRequired);
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

      // 2. Dá entrada no produto final acabado fabricado
      await tx.product.update({
        where: { id: order.productId },
        data: { stock: { increment: order.quantity } },
      });

      await tx.stockMovement.create({
        data: {
          productId: order.productId,
          type: "ENTRADA",
          quantity: order.quantity,
          reason: `Produção concluída OP ${order.code} - Máquina ${order.machine}`,
          userId: session.userId,
        },
      });

      // 3. Atualiza status da OP para CONCLUIDA
      await tx.productionOrder.update({
        where: { id },
        data: {
          status: "CONCLUIDA",
          completedAt: new Date(),
        },
      });
    });

    await logAudit(session, "PRODUCAO", "CONCLUIR", `OP #${id} concluída. Insumos baixados e produto acabado adicionado ao estoque.`, id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao concluir produção.";
    redirect(`/producao/${id}?erro=${encodeURIComponent(msg)}`);
  }

  revalidateAll();
  redirect(`/producao/${id}?ok=${encodeURIComponent("Produção finalizada! Insumos baixados e produtos acabados adicionados ao estoque com sucesso.")}`);
}

export async function cancelProductionOrder(id: number) {
  const session = await requireUser();
  await ensureStockLocationTables();

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.productionOrder.findUnique({
        where: { id },
        include: {
          product: true,
          items: {
            include: { product: true },
          },
        },
      });

      if (!order) throw new ValidationError("Ordem de produção não encontrada.");
      if (order.status === "CANCELADA") {
        throw new ValidationError("Esta OP já está cancelada.");
      }

      // Se a ordem já havia sido concluída, desfaz os movimentos de estoque
      if (order.status === "CONCLUIDA") {
        // Estorna o produto fabricado (diminui)
        await tx.product.update({
          where: { id: order.productId },
          data: { stock: { decrement: order.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            productId: order.productId,
            type: "SAIDA",
            quantity: order.quantity,
            reason: `Estorno do cancelamento da OP ${order.code}`,
            userId: session.userId,
          },
        });

        // Devolve os insumos consumidos de volta ao estoque (aumenta)
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantityRequired } },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: "ENTRADA",
              quantity: item.quantityRequired,
              reason: `Estorno do consumo da OP ${order.code}`,
              userId: session.userId,
            },
          });
        }
      }

      await tx.productionOrder.update({
        where: { id },
        data: { status: "CANCELADA" },
      });
    });

    await logAudit(session, "PRODUCAO", "CANCELAR", `OP #${id} cancelada.`, id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao cancelar OP.";
    redirect(`/producao/${id}?erro=${encodeURIComponent(msg)}`);
  }

  revalidateAll();
  redirect(`/producao/${id}?ok=${encodeURIComponent("Ordem de produção cancelada.")}`);
}

export async function createProductionMachine(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireUser();
  await ensureStockLocationTables();

  try {
    const name = str(fd, "name");
    const code = str(fd, "code");
    const category = str(fd, "category");
    const location = str(fd, "location");

    if (!name) {
      throw new ValidationError("O nome da máquina ou posto de trabalho é obrigatório.");
    }

    const existing = await prisma.productionMachine.findUnique({
      where: { name },
    });
    if (existing) {
      throw new ValidationError(`Já existe uma máquina cadastrada com o nome "${name}".`);
    }

    await prisma.productionMachine.create({
      data: {
        name,
        code: code || null,
        category: category || null,
        location: location || null,
        active: true,
      },
    });

    await logAudit(session, "PRODUCAO", "CRIAR_MAQUINA", `Máquina ${name} cadastrada.`);
  } catch (err) {
    return toFormError(err);
  }

  revalidateAll();
  redirect(`/producao?tab=maquinas&ok=${encodeURIComponent("Máquina cadastrada com sucesso!")}`);
}

export async function deleteProductionMachine(id: number) {
  const session = await requireUser();
  await ensureStockLocationTables();

  try {
    const machine = await prisma.productionMachine.findUnique({ where: { id } });
    if (!machine) throw new ValidationError("Máquina não encontrada.");

    await prisma.productionMachine.delete({ where: { id } });
    await logAudit(session, "PRODUCAO", "EXCLUIR_MAQUINA", `Máquina ${machine.name} removida.`, id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao remover máquina.";
    redirect(`/producao?tab=maquinas&erro=${encodeURIComponent(msg)}`);
  }

  revalidateAll();
  redirect(`/producao?tab=maquinas&ok=${encodeURIComponent("Máquina removida com sucesso!")}`);
}
