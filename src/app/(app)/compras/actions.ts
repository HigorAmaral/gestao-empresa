"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { dateVal, intOrNull, str, toFormError, ValidationError, type FormState } from "@/lib/form";
import { parseItems, round2 } from "@/lib/items";
import { parseNfeXml } from "@/lib/nfe/xml-import";
import { ensureStockLocationTables } from "@/lib/stock-location";

function back(id: number, key: "ok" | "erro", msg: string): never {
  redirect(`/compras/${id}?${key}=${encodeURIComponent(msg)}`);
}

function revalidateAll() {
  for (const p of ["/compras", "/produtos", "/estoque", "/financeiro", "/"]) revalidatePath(p);
}

/** Cria/edita um pedido de compra pendente e mantém a conta a pagar vinculada. */
export async function savePurchase(id: number | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireUser();
  let purchaseId = id;
  try {
    const items = parseItems(fd);
    const supplierId = intOrNull(fd, "supplierId");
    if (!supplierId) throw new ValidationError("Selecione o fornecedor.");
    const date = dateVal(fd, "date") ?? new Date();
    const dueDate = dateVal(fd, "dueDate") ?? date;
    const total = round2(items.reduce((s, i) => s + i.quantity * i.price, 0));
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new ValidationError("Fornecedor não encontrado.");

    const data = { supplierId, date, dueDate, total, notes: str(fd, "notes") };
    const itemRows = items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      unitCost: i.price,
      total: round2(i.quantity * i.price),
    }));

    await prisma.$transaction(async (tx) => {
      if (id) {
        const purchase = await tx.purchase.findUnique({ where: { id } });
        if (!purchase) throw new ValidationError("Compra não encontrada.");
        if (purchase.status !== "PENDENTE") throw new ValidationError("Apenas compras pendentes podem ser editadas.");
        await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
        await tx.purchase.update({ where: { id }, data: { ...data, items: { create: itemRows } } });
      } else {
        const p = await tx.purchase.create({ data: { ...data, userId: session.userId, items: { create: itemRows } } });
        purchaseId = p.id;
      }

      // Conta a pagar vinculada (atualiza se ainda estiver pendente)
      const entry = await tx.financialEntry.findFirst({ where: { purchaseId: purchaseId!, status: { not: "CANCELADO" } } });
      const finData = {
        type: "DESPESA",
        description: `Compra #${purchaseId} — ${supplier.name}`,
        category: "Compras",
        amount: total,
        dueDate,
        purchaseId: purchaseId!,
      };
      if (!entry) await tx.financialEntry.create({ data: finData });
      else if (entry.status === "PENDENTE") await tx.financialEntry.update({ where: { id: entry.id }, data: finData });
    });
  } catch (e) {
    return toFormError(e);
  }
  revalidateAll();
  back(purchaseId!, "ok", "Compra salva e conta a pagar lançada. Ao receber a mercadoria, clique em \"Receber\".");
}

/** Recebe a mercadoria: soma ao estoque e atualiza o preço de custo dos produtos. */
export async function receivePurchase(id: number) {
  const session = await requireUser();
  try {
    await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({ where: { id }, include: { items: true } });
      if (!purchase) throw new ValidationError("Compra não encontrada.");
      if (purchase.status !== "PENDENTE") throw new ValidationError("Esta compra não está pendente.");
      for (const item of purchase.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity }, costPrice: item.unitCost },
        });
        await tx.stockMovement.create({
          data: { productId: item.productId, type: "ENTRADA", quantity: item.quantity, reason: `Compra #${id}`, userId: session.userId },
        });
      }
      await tx.purchase.update({ where: { id }, data: { status: "RECEBIDA", receivedAt: new Date() } });
    });
  } catch (e) {
    const r = toFormError(e);
    back(id, "erro", r?.error ?? "Erro ao receber.");
  }
  revalidateAll();
  back(id, "ok", "Mercadoria recebida! Estoque e custos atualizados.");
}

export async function cancelPurchase(id: number) {
  const session = await requireUser();
  try {
    await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({ where: { id }, include: { items: { include: { product: true } } } });
      if (!purchase) throw new ValidationError("Compra não encontrada.");
      if (purchase.status === "CANCELADA") throw new ValidationError("A compra já está cancelada.");
      if (purchase.status === "RECEBIDA") {
        for (const item of purchase.items) {
          if (item.product.stock < item.quantity)
            throw new ValidationError(`Não é possível estornar: "${item.product.name}" tem apenas ${item.product.stock} em estoque.`);
        }
        for (const item of purchase.items) {
          await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: "SAIDA",
              quantity: item.quantity,
              reason: `Cancelamento da compra #${id}`,
              userId: session.userId,
            },
          });
        }
      }
      await tx.financialEntry.updateMany({ where: { purchaseId: id, status: "PENDENTE" }, data: { status: "CANCELADO" } });
      await tx.purchase.update({ where: { id }, data: { status: "CANCELADA" } });
    });
  } catch (e) {
    const r = toFormError(e);
    back(id, "erro", r?.error ?? "Erro ao cancelar.");
  }
  revalidateAll();
  back(id, "ok", "Compra cancelada.");
}

export async function deletePurchase(id: number) {
  await requireUser();
  const purchase = await prisma.purchase.findUnique({ where: { id } });
  if (!purchase) redirect("/compras");
  if (purchase.status === "RECEBIDA") back(id, "erro", "Cancele a compra antes de excluí-la.");
  await prisma.$transaction([
    prisma.financialEntry.deleteMany({ where: { purchaseId: id, status: { not: "PAGO" } } }),
    prisma.purchase.delete({ where: { id } }),
  ]);
  revalidateAll();
  redirect("/compras?ok=" + encodeURIComponent(`Compra #${id} excluída.`));
}

/** Importa um XML de NF-e de Fornecedor: cadastra fornecedor, produtos, compra, estoque e parcelas financeiras. */
export async function importPurchaseXml(fd: FormData): Promise<{ error?: string }> {
  const session = await requireUser();
  await ensureStockLocationTables();
  let createdPurchaseId = 0;
  let summaryMsg = "";

  try {
    const xmlContent = str(fd, "xmlContent");
    if (!xmlContent) throw new ValidationError("Envie ou cole o conteúdo XML da NF-e.");
    const receiveImmediately = fd.get("receiveImmediately") === "true" || fd.get("receiveImmediately") === "on";
    const markupPercent = Number(fd.get("markupPercent") ?? 45) || 45;

    const parsed = parseNfeXml(xmlContent);
    const issueDate = new Date(parsed.issueDate + "T12:00:00Z");
    const firstDue = parsed.duplicates[0]?.dueDate
      ? new Date(parsed.duplicates[0].dueDate + "T12:00:00Z")
      : issueDate;

    await prisma.$transaction(async (tx) => {
      // 1. Localiza ou cadastra Fornecedor
      const cleanCnpj = parsed.supplier.cnpj.replace(/\D/g, "");
      let supplier = cleanCnpj
        ? await tx.supplier.findFirst({
            where: {
              OR: [
                { document: parsed.supplier.cnpj },
                { document: cleanCnpj },
              ],
            },
          })
        : null;

      if (!supplier) {
        supplier = await tx.supplier.findFirst({
          where: { name: { equals: parsed.supplier.name } },
        });
      }

      if (!supplier) {
        supplier = await tx.supplier.create({
          data: {
            name: parsed.supplier.tradeName || parsed.supplier.name,
            document: parsed.supplier.cnpj || null,
            phone: parsed.supplier.phone || null,
            email: parsed.supplier.email || null,
            address: parsed.supplier.address || null,
            city: parsed.supplier.city || null,
            state: parsed.supplier.state || null,
            notes: `Cadastrado automaticamente via XML NF-e #${parsed.number}`,
          },
        });
      }

      // 2. Localiza ou cadastra cada Produto da NF-e
      const purchaseItemRows: { productId: number; quantity: number; unitCost: number; total: number }[] = [];
      let newProductsCount = 0;

      for (const item of parsed.items) {
        let product = await tx.product.findFirst({
          where: {
            OR: [
              { sku: item.code },
              { name: item.name },
            ],
          },
        });

        if (!product) {
          const suggestedSalePrice = round2(item.unitCost * (1 + markupPercent / 100));
          const uniqueSku = (await tx.product.findUnique({ where: { sku: item.code } }))
            ? `${item.code}-${Date.now().toString().slice(-4)}`
            : item.code;

          product = await tx.product.create({
            data: {
              sku: uniqueSku,
              name: item.name,
              category: "Importado NF-e",
              unit: item.unit || "UN",
              costPrice: item.unitCost,
              salePrice: suggestedSalePrice,
              stock: receiveImmediately ? item.quantity : 0,
              minStock: 2,
              ncm: item.ncm || "00000000",
              cest: item.cest || null,
              cfop: "5102",
              supplierId: supplier.id,
            },
          });
          newProductsCount++;
        } else {
          await tx.product.update({
            where: { id: product.id },
            data: {
              costPrice: item.unitCost,
              ncm: item.ncm || product.ncm,
              ...(receiveImmediately ? { stock: { increment: item.quantity } } : {}),
            },
          });
        }

        if (receiveImmediately) {
          await tx.stockMovement.create({
            data: {
              productId: product.id,
              type: "ENTRADA",
              quantity: item.quantity,
              reason: `Importação XML NF-e #${parsed.number} (${supplier.name})`,
              userId: session.userId,
            },
          });
        }

        purchaseItemRows.push({
          productId: product.id,
          quantity: item.quantity,
          unitCost: item.unitCost,
          total: item.total,
        });
      }

      // 3. Cria o Pedido de Compra
      const purchase = await tx.purchase.create({
        data: {
          supplierId: supplier.id,
          userId: session.userId,
          date: issueDate,
          dueDate: firstDue,
          receivedAt: receiveImmediately ? new Date() : null,
          status: receiveImmediately ? "RECEBIDA" : "PENDENTE",
          total: parsed.totalInvoice,
          notes: `Importado via XML NF-e Nº ${parsed.number} (Série ${parsed.series})${parsed.accessKey ? ` — Chave: ${parsed.accessKey}` : ""}`,
          items: { create: purchaseItemRows },
        },
      });
      createdPurchaseId = purchase.id;

      // 4. Se recebido imediatamente, registra também no módulo de Recebimento (GoodsReceipt)
      if (receiveImmediately) {
        const receiptCode = `REC-NFE-${parsed.number}-${Date.now().toString().slice(-3)}`;
        await tx.goodsReceipt.create({
          data: {
            code: receiptCode,
            invoiceNumber: parsed.number,
            supplierId: supplier.id,
            purchaseId: purchase.id,
            status: "RECEBIDO",
            userId: session.userId,
            notes: `Recebimento automático via importação de XML NF-e #${parsed.number}`,
            items: {
              create: purchaseItemRows.map((pi) => ({
                productId: pi.productId,
                quantity: pi.quantity,
                unitCost: pi.unitCost,
              })),
            },
          },
        });
      }

      // 5. Gera as Duplicatas / Parcelas no Contas a Pagar
      const recGroup = `NFE-${parsed.number}-${purchase.id}`;
      if (parsed.duplicates.length > 0) {
        const totalDups = parsed.duplicates.length;
        for (let i = 0; i < totalDups; i++) {
          const dup = parsed.duplicates[i];
          await tx.financialEntry.create({
            data: {
              type: "DESPESA",
              description: `NF-e #${parsed.number} (${i + 1}/${totalDups}) — ${supplier.name}`,
              category: "Compras (NF-e)",
              amount: dup.amount,
              dueDate: new Date(dup.dueDate + "T12:00:00Z"),
              status: "PENDENTE",
              purchaseId: purchase.id,
              installmentNumber: i + 1,
              installmentTotal: totalDups,
              recurrenceGroup: recGroup,
            },
          });
        }
      } else {
        await tx.financialEntry.create({
          data: {
            type: "DESPESA",
            description: `NF-e #${parsed.number} — ${supplier.name}`,
            category: "Compras (NF-e)",
            amount: parsed.totalInvoice,
            dueDate: firstDue,
            status: "PENDENTE",
            purchaseId: purchase.id,
          },
        });
      }

      summaryMsg = `NF-e #${parsed.number} de "${supplier.name}" importada! ${parsed.items.length} item(ns) processado(s) (${newProductsCount} novo(s) cadastrado(s))${receiveImmediately ? ", estoque alimentado" : ""} e financeiro lançado.`;
    });

    await logAudit(session, "COMPRAS", "CRIAR", summaryMsg, createdPurchaseId);
  } catch (e) {
    return toFormError(e) ?? { error: "Falha ao importar XML." };
  }

  for (const p of ["/compras", "/recebimento", "/produtos", "/estoque", "/financeiro", "/fornecedores", "/"]) {
    revalidatePath(p);
  }
  redirect(`/compras/${createdPurchaseId}?ok=${encodeURIComponent(summaryMsg)}`);
}
