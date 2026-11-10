"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { ensureStockLocationTables } from "@/lib/stock-location";
import {
  bool,
  intOrNull,
  num,
  reqStr,
  str,
  toFormError,
  ValidationError,
  type FormState,
} from "@/lib/form";

/** Salva (cria ou atualiza) um endereço físico de estoque. */
export async function saveLocation(
  id: number | null,
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  const session = await requireUser();
  await ensureStockLocationTables();
  try {
    const code = reqStr(fd, "code", "Código do Endereço").toUpperCase().trim();
    const aisle = str(fd, "aisle");
    const rack = str(fd, "rack");
    const shelf = str(fd, "shelf");
    const bin = str(fd, "bin");
    const description = str(fd, "description");
    const active = bool(fd, "active");

    const existing = await prisma.stockLocation.findUnique({ where: { code } });
    if (existing && (!id || existing.id !== id)) {
      throw new ValidationError(`O código de endereço "${code}" já está em uso.`);
    }

    if (id) {
      await prisma.stockLocation.update({
        where: { id },
        data: { code, aisle, rack, shelf, bin, description, active },
      });
      await logAudit(
        session,
        "ESTOQUE",
        "EDITAR",
        `Atualizou endereço de estoque: ${code}`,
        id
      );
    } else {
      const created = await prisma.stockLocation.create({
        data: { code, aisle, rack, shelf, bin, description, active },
      });
      await logAudit(
        session,
        "ESTOQUE",
        "CRIAR",
        `Criou novo endereço de estoque: ${code}`,
        created.id
      );
    }
  } catch (e) {
    return toFormError(e);
  }

  revalidatePath("/estoque");
  revalidatePath("/estoque/enderecamento");
  return { success: "Endereço salvo com sucesso." };
}

/** Endereça um produto em uma localização informando a quantidade armazenada. */
export async function assignProductLocation(
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  const session = await requireUser();
  await ensureStockLocationTables();
  try {
    const productId = intOrNull(fd, "productId");
    const locationId = intOrNull(fd, "locationId");
    const quantity = num(fd, "quantity", NaN);
    const notes = str(fd, "notes");

    if (!productId) throw new ValidationError("Selecione um produto.");
    if (!locationId) throw new ValidationError("Selecione um endereço de estoque.");
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new ValidationError("Informe uma quantidade válida (maior ou igual a zero).");
    }

    const [product, location] = await Promise.all([
      prisma.product.findUnique({ where: { id: productId } }),
      prisma.stockLocation.findUnique({ where: { id: locationId } }),
    ]);

    if (!product) throw new ValidationError("Produto não encontrado.");
    if (!location) throw new ValidationError("Endereço de estoque não encontrado.");

    if (quantity === 0) {
      // Se quantidade for 0, remove o vínculo para manter limpo
      await prisma.productStockLocation.deleteMany({
        where: { productId, locationId },
      });
      await logAudit(
        session,
        "ESTOQUE",
        "EXCLUIR",
        `Desendereçou produto ${product.sku} do endereço ${location.code}`
      );
    } else {
      await prisma.productStockLocation.upsert({
        where: {
          productId_locationId: { productId, locationId },
        },
        create: {
          productId,
          locationId,
          quantity,
          notes,
        },
        update: {
          quantity,
          notes,
        },
      });
      await logAudit(
        session,
        "ESTOQUE",
        "ENDERECAR",
        `Endereçou ${quantity} ${product.unit} de ${product.sku} no endereço ${location.code}`
      );
    }
  } catch (e) {
    return toFormError(e);
  }

  revalidatePath("/estoque");
  revalidatePath("/estoque/enderecamento");
  revalidatePath("/produtos");
  return { success: "Produto endereçado com sucesso." };
}

/** Transfere produtos de um endereço de origem para outro de destino. */
export async function transferProductLocation(
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  const session = await requireUser();
  await ensureStockLocationTables();
  try {
    const productId = intOrNull(fd, "productId");
    const fromLocationId = intOrNull(fd, "fromLocationId");
    const toLocationId = intOrNull(fd, "toLocationId");
    const quantity = num(fd, "quantity", NaN);

    if (!productId) throw new ValidationError("Selecione o produto.");
    if (!fromLocationId) throw new ValidationError("Selecione o endereço de origem.");
    if (!toLocationId) throw new ValidationError("Selecione o endereço de destino.");
    if (fromLocationId === toLocationId) {
      throw new ValidationError("O endereço de origem e destino não podem ser iguais.");
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ValidationError("Informe uma quantidade válida para transferir.");
    }

    await prisma.$transaction(async (tx) => {
      const source = await tx.productStockLocation.findUnique({
        where: { productId_locationId: { productId, locationId: fromLocationId } },
        include: { product: true, location: true },
      });

      if (!source || source.quantity < quantity) {
        throw new ValidationError(
          `Quantidade insuficiente no endereço de origem (disponível: ${source?.quantity ?? 0}).`
        );
      }

      const destLocation = await tx.stockLocation.findUnique({
        where: { id: toLocationId },
      });
      if (!destLocation) throw new ValidationError("Endereço de destino não encontrado.");

      // Subtrai da origem
      const rem = source.quantity - quantity;
      if (rem <= 0) {
        await tx.productStockLocation.delete({ where: { id: source.id } });
      } else {
        await tx.productStockLocation.update({
          where: { id: source.id },
          data: { quantity: rem },
        });
      }

      // Adiciona ao destino
      await tx.productStockLocation.upsert({
        where: { productId_locationId: { productId, locationId: toLocationId } },
        create: {
          productId,
          locationId: toLocationId,
          quantity,
          notes: source.notes,
        },
        update: {
          quantity: { increment: quantity },
        },
      });

      await logAudit(
        session,
        "ESTOQUE",
        "TRANSFERIR",
        `Transferiu ${quantity} ${source.product.unit} de ${source.product.sku} de ${source.location.code} para ${destLocation.code}`
      );
    });
  } catch (e) {
    return toFormError(e);
  }

  revalidatePath("/estoque");
  revalidatePath("/estoque/enderecamento");
  return { success: "Transferência realizada com sucesso." };
}

/** Gerador em lote de endereços (ex.: Corredor A, Estantes 1..3, Níveis 1..4). */
export async function batchCreateLocations(
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  const session = await requireUser();
  await ensureStockLocationTables();
  try {
    const aislePrefix = reqStr(fd, "aislePrefix", "Letra/Nome do Corredor (ex: A)").toUpperCase().trim();
    const racksCount = Number(fd.get("racksCount")) || 1;
    const shelvesCount = Number(fd.get("shelvesCount")) || 1;
    const binsCount = Number(fd.get("binsCount")) || 1;

    if (racksCount < 1 || racksCount > 20) throw new ValidationError("Estantes deve ser entre 1 e 20.");
    if (shelvesCount < 1 || shelvesCount > 10) throw new ValidationError("Níveis deve ser entre 1 e 10.");
    if (binsCount < 1 || binsCount > 10) throw new ValidationError("Vãos/Gavetas deve ser entre 1 e 10.");

    let createdCount = 0;
    for (let r = 1; r <= racksCount; r++) {
      const rackStr = String(r).padStart(2, "0");
      for (let s = 1; s <= shelvesCount; s++) {
        const shelfStr = String(s).padStart(2, "0");
        for (let b = 1; b <= binsCount; b++) {
          const binStr = binsCount > 1 ? `-${String(b).padStart(2, "0")}` : "";
          const code = `${aislePrefix}-${rackStr}-${shelfStr}${binStr}`;

          const exists = await prisma.stockLocation.findUnique({ where: { code } });
          if (!exists) {
            await prisma.stockLocation.create({
              data: {
                code,
                aisle: `Corredor ${aislePrefix}`,
                rack: `Estante ${rackStr}`,
                shelf: `Nível ${shelfStr}`,
                bin: binsCount > 1 ? `Posição ${b}` : null,
              },
            });
            createdCount++;
          }
        }
      }
    }

    await logAudit(
      session,
      "ESTOQUE",
      "CRIAR_LOTE",
      `Criou em lote ${createdCount} novos endereços no Corredor ${aislePrefix}`
    );

    revalidatePath("/estoque");
    revalidatePath("/estoque/enderecamento");
    return { success: `${createdCount} endereço(s) gerado(s) com sucesso.` };
  } catch (e) {
    return toFormError(e);
  }
}

/** Desvincula um produto de um endereço. */
export async function deleteProductLocation(id: number) {
  const session = await requireUser();
  const item = await prisma.productStockLocation.findUnique({
    where: { id },
    include: { product: true, location: true },
  });
  if (item) {
    await prisma.productStockLocation.delete({ where: { id } });
    await logAudit(
      session,
      "ESTOQUE",
      "EXCLUIR",
      `Removeu ${item.quantity} ${item.product.unit} de ${item.product.sku} do endereço ${item.location.code}`
    );
  }
  revalidatePath("/estoque");
  revalidatePath("/estoque/enderecamento");
}

/** Exclui um endereço de estoque se estiver vazio. */
export async function deleteLocation(id: number) {
  const session = await requireUser();
  const count = await prisma.productStockLocation.count({ where: { locationId: id } });
  if (count > 0) {
    throw new Error("Não é possível excluir um endereço com produtos armazenados.");
  }
  const loc = await prisma.stockLocation.findUnique({ where: { id } });
  if (loc) {
    await prisma.stockLocation.delete({ where: { id } });
    await logAudit(session, "ESTOQUE", "EXCLUIR", `Excluiu endereço de estoque: ${loc.code}`);
  }
  revalidatePath("/estoque");
  revalidatePath("/estoque/enderecamento");
}
