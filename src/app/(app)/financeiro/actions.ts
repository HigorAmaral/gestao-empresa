"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { dateVal, intOrNull, num, reqStr, str, toFormError, ValidationError, type FormState } from "@/lib/form";
import { parseOfxContent } from "@/lib/ofx-parser";
import { ensureStockLocationTables } from "@/lib/stock-location";

function revalidateAll() {
  for (const p of ["/financeiro", "/", "/relatorios"]) revalidatePath(p);
}

export async function saveEntry(id: number | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireAdmin();
  await ensureStockLocationTables();
  try {
    const type = str(fd, "type");
    if (type !== "RECEITA" && type !== "DESPESA") throw new ValidationError("Tipo inválido.");
    const amount = num(fd, "amount");
    if (amount <= 0) throw new ValidationError("O valor deve ser maior que zero.");
    const dueDate = dateVal(fd, "dueDate");
    if (!dueDate) throw new ValidationError("Informe o vencimento.");
    const status = str(fd, "status") ?? "PENDENTE";
    if (!["PENDENTE", "PAGO", "CANCELADO"].includes(status)) throw new ValidationError("Status inválido.");
    const paidAt = status === "PAGO" ? (dateVal(fd, "paidAt") ?? new Date()) : null;
    const bankAccountId = intOrNull(fd, "bankAccountId");
    const frequency = str(fd, "frequency") ?? "MENSAL"; // MENSAL | QUINZENAL | SEMANAL | ANUAL

    const data = {
      type,
      description: reqStr(fd, "description", "Descrição"),
      category: str(fd, "category"),
      amount,
      dueDate,
      status,
      paidAt,
      bankAccountId,
      notes: str(fd, "notes"),
    };

    const repeat = Math.min(60, Math.max(1, Math.floor(num(fd, "repeat", 1))));
    if (id) {
      await prisma.financialEntry.update({ where: { id }, data });
      await logAudit(session, "FINANCEIRO", "EDITAR", `Editou lançamento #${id} (${data.description})`, id);
    } else if (repeat > 1) {
      const recGroup = `REC-${Date.now()}`;
      const rows = Array.from({ length: repeat }, (_, i) => {
        const d = new Date(dueDate);
        if (frequency === "SEMANAL") d.setUTCDate(d.getUTCDate() + i * 7);
        else if (frequency === "QUINZENAL") d.setUTCDate(d.getUTCDate() + i * 15);
        else if (frequency === "ANUAL") d.setUTCFullYear(d.getUTCFullYear() + i);
        else d.setUTCMonth(d.getUTCMonth() + i);

        return {
          ...data,
          description: `${data.description} (${i + 1}/${repeat})`,
          dueDate: d,
          status: i === 0 ? status : "PENDENTE",
          paidAt: i === 0 ? paidAt : null,
          installmentNumber: i + 1,
          installmentTotal: repeat,
          recurrenceGroup: recGroup,
        };
      });
      await prisma.financialEntry.createMany({ data: rows });
      await logAudit(session, "FINANCEIRO", "CRIAR", `Criou ${repeat} parcelas (${frequency}) de "${data.description}"`, null);
    } else {
      const created = await prisma.financialEntry.create({ data });
      await logAudit(session, "FINANCEIRO", "CRIAR", `Criou lançamento "${data.description}" (R$ ${amount.toFixed(2)})`, created.id);
    }
  } catch (e) {
    return toFormError(e);
  }
  revalidateAll();
  redirect("/financeiro?ok=" + encodeURIComponent("Lançamento salvo com sucesso."));
}

export async function markPaid(id: number, returnTo: string) {
  const session = await requireAdmin();
  await ensureStockLocationTables();
  const entry = await prisma.financialEntry.update({ where: { id }, data: { status: "PAGO", paidAt: new Date() } });
  await logAudit(session, "FINANCEIRO", "BAIXAR", `Baixou lançamento "${entry.description}" como PAGO`, id);
  revalidateAll();
  redirect(returnTo + (returnTo.includes("?") ? "&" : "?") + "ok=" + encodeURIComponent("Lançamento baixado como pago."));
}

export async function deleteEntry(id: number) {
  const session = await requireAdmin();
  await ensureStockLocationTables();
  const entry = await prisma.financialEntry.findUnique({ where: { id } });
  await prisma.financialEntry.delete({ where: { id } });
  await logAudit(session, "FINANCEIRO", "EXCLUIR", `Excluiu lançamento "${entry?.description ?? id}"`, id);
  revalidateAll();
  redirect("/financeiro?ok=" + encodeURIComponent("Lançamento excluído."));
}

export async function createBankAccountAction(fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  const session = await requireAdmin();
  await ensureStockLocationTables();
  try {
    const name = reqStr(fd, "name", "Nome da Conta / Carteira");
    const bankName = str(fd, "bankName");
    const agency = str(fd, "agency");
    const accountNumber = str(fd, "accountNumber");
    const type = str(fd, "type") ?? "CORRENTE";
    const initialBalance = num(fd, "initialBalance", 0);

    const created = await prisma.bankAccount.create({
      data: {
        name,
        bankName,
        agency,
        accountNumber,
        type,
        initialBalance,
      },
    });
    await logAudit(session, "FINANCEIRO", "CRIAR", `Cadastrou conta bancária "${name}"`, created.id);
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao criar conta bancária." };
  }
}

export async function deleteBankAccountAction(id: number) {
  const session = await requireAdmin();
  await ensureStockLocationTables();
  await prisma.bankAccount.delete({ where: { id } });
  await logAudit(session, "FINANCEIRO", "EXCLUIR", `Removeu conta bancária #${id}`, id);
  revalidateAll();
}

export async function importOfxStatementAction(fd: FormData): Promise<{ ok?: boolean; message?: string; error?: string }> {
  const session = await requireAdmin();
  await ensureStockLocationTables();

  try {
    const ofxContent = str(fd, "ofxContent");
    if (!ofxContent) throw new ValidationError("Selecione um arquivo .OFX para conciliar.");
    const bankAccountId = intOrNull(fd, "bankAccountId");

    const parsed = parseOfxContent(ofxContent);
    let reconciledCount = 0;
    let createdCount = 0;
    let skippedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const item of parsed.transactions) {
        // Verifica se já foi importado pelo FITID
        const alreadyImported = await tx.financialEntry.findFirst({
          where: { ofxFitId: item.fitId },
        });
        if (alreadyImported) {
          skippedCount++;
          continue;
        }

        // Tenta localizar um lançamento PENDENTE do mesmo tipo e mesmo valor aproximado
        const openCandidates = await tx.financialEntry.findMany({
          where: {
            status: "PENDENTE",
            type: item.type,
            amount: { gte: item.amount - 0.05, lte: item.amount + 0.05 },
          },
          orderBy: { dueDate: "asc" },
          take: 1,
        });

        const txDate = new Date(item.date + "T12:00:00Z");

        if (openCandidates.length > 0) {
          const match = openCandidates[0];
          await tx.financialEntry.update({
            where: { id: match.id },
            data: {
              status: "PAGO",
              paidAt: txDate,
              bankAccountId: bankAccountId ?? match.bankAccountId,
              ofxFitId: item.fitId,
              notes: [match.notes, `Conciliado via OFX (${item.description})`].filter(Boolean).join(" | "),
            },
          });
          reconciledCount++;
        } else {
          await tx.financialEntry.create({
            data: {
              type: item.type,
              description: item.description,
              category: item.type === "RECEITA" ? "Recebimento Bancário (OFX)" : "Despesa Bancária (OFX)",
              amount: item.amount,
              dueDate: txDate,
              paidAt: txDate,
              status: "PAGO",
              bankAccountId,
              ofxFitId: item.fitId,
              notes: `Importado automaticamente via extrato OFX (FITID: ${item.fitId})`,
            },
          });
          createdCount++;
        }
      }
    });

    const msg = `Conciliação OFX concluída: ${reconciledCount} lançamento(s) pendente(s) baixado(s) automaticamente, ${createdCount} novo(s) registrado(s)${skippedCount > 0 ? ` (${skippedCount} já importado(s) ignorado(s))` : ""}.`;
    await logAudit(session, "FINANCEIRO", "BAIXAR", msg, bankAccountId);
    revalidateAll();
    return { ok: true, message: msg };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao processar arquivo OFX." };
  }
}
