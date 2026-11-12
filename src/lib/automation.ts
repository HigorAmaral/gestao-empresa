import { prisma } from "@/lib/prisma";
import { processPayrollForMonth } from "@/lib/payroll";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { revalidatePath, revalidateTag } from "next/cache";

export type AutomationResult = {
  timestamp: string;
  recurrentEntriesGenerated: number;
  lowStockPurchasesSuggested: number;
  sstExpiredFlagged: number;
  payrollProcessed: string | null;
  overdueTasksFlagged: number;
  pendingQualityInspections: number;
  overdueRncsFlagged: number;
  summary: string[];
};

/**
 * Gera automaticamente rascunhos de Pedido de Compra (+ previsão no Financeiro)
 * para produtos ativos com estoque <= estoque mínimo, agrupados por fornecedor
 * (inferindo último fornecedor de compras/recebimentos quando não houver padrão).
 */
export async function ensureLowStockPurchaseDrafts(productIds?: number[]): Promise<number> {
  await ensureStockLocationTables();
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const criticalProductsAll = await prisma.$queryRaw<
    { id: number; name: string; stock: number; minStock: number; costPrice: number; supplierId: number | null }[]
  >`
    SELECT id, name, stock, "minStock", "costPrice", "supplierId"
    FROM "Product"
    WHERE active = true AND stock <= "minStock"
  `;

  const criticalProducts =
    productIds && productIds.length > 0
      ? criticalProductsAll.filter((p) => productIds.includes(p.id))
      : criticalProductsAll;

  if (criticalProducts.length === 0) return 0;

  // Infere último fornecedor conhecido caso o produto ainda não tenha supplierId padrão
  const resolvedProducts = await Promise.all(
    criticalProducts.map(async (p) => {
      if (p.supplierId) return p;
      const lastPurchase = await prisma.purchaseItem
        .findFirst({
          where: { productId: p.id },
          orderBy: { id: "desc" },
          include: { purchase: { select: { supplierId: true } } },
        })
        .catch(() => null);
      if (lastPurchase?.purchase?.supplierId) {
        return { ...p, supplierId: lastPurchase.purchase.supplierId, costPrice: p.costPrice || lastPurchase.unitCost };
      }
      const lastReceipt = await prisma.goodsReceiptItem
        .findFirst({
          where: { productId: p.id },
          orderBy: { id: "desc" },
          include: { receipt: { select: { supplierId: true } } },
        })
        .catch(() => null);
      if (lastReceipt?.receipt?.supplierId) {
        return { ...p, supplierId: lastReceipt.receipt.supplierId, costPrice: p.costPrice || lastReceipt.unitCost };
      }
      return p;
    }),
  );

  const bySupplier = new Map<number | null, typeof resolvedProducts>();
  for (const p of resolvedProducts) {
    const supId = p.supplierId ?? null;
    const list = bySupplier.get(supId) || [];
    list.push(p);
    bySupplier.set(supId, list);
  }

  let createdCount = 0;
  for (const [supplierId, items] of bySupplier.entries()) {
    const existingPurchase = await prisma.purchase.findFirst({
      where: {
        supplierId,
        status: "PENDENTE",
        notes: { contains: "REPOSICAO_AUTOMATICA" },
        createdAt: { gte: today },
      },
    });

    if (!existingPurchase) {
      const purchaseItemsData = items.map((p) => {
        const needQty = Math.max(1, Math.ceil(p.minStock * 2 - p.stock));
        const unitCost = p.costPrice > 0 ? p.costPrice : 10;
        return {
          productId: p.id,
          quantity: needQty,
          unitCost,
          total: Math.round(needQty * unitCost * 100) / 100,
        };
      });

      const totalCost = Math.round(purchaseItemsData.reduce((s, it) => s + it.total, 0) * 100) / 100;

      await prisma.purchase.create({
        data: {
          supplierId,
          status: "PENDENTE",
          total: totalCost,
          notes: "REPOSICAO_AUTOMATICA: Gerado automaticamente para suprir estoque mínimo crítico",
          dueDate: new Date(today.getTime() + 15 * 86400000),
          items: { create: purchaseItemsData },
          financial: {
            create: {
              type: "DESPESA",
              description: `Compra Automática Reposição — ${items.length} produto(s)`,
              category: "Compras",
              amount: totalCost,
              dueDate: new Date(today.getTime() + 15 * 86400000),
              status: "PENDENTE",
              notes: "Provisionamento automático de compra para estoque mínimo",
            },
          },
        },
      });
      createdCount++;
    }
  }

  if (createdCount > 0) {
    revalidateTag("sidebar-alerts", "max");
    revalidatePath("/compras");
    revalidatePath("/financeiro");
  }
  return createdCount;
}

/**
 * Motor Geral de Automações do Sistema:
 * 1. Projeção e lançamento automático de despesas recorrentes (Aluguel, Luz, Internet, Assinaturas);
 * 2. Análise inteligente de estoque mínimo e geração automática de pedidos de compra em rascunho;
 * 3. Varredura de vencimento de EPIs e ASOs de segurança do trabalho;
 * 4. Fechamento automático de Folha de Pagamento do mês (a partir do dia 25 ou se forcePayroll=true);
 * 5. Verificação e alerta de ordens de serviço atrasadas;
 * 6. Faturamento automático de contratos recorrentes;
 * 7. Verificação de inspeções de qualidade pendentes e RNCs vencidas;
 * 8. Disparo opcional de resumo via Webhook (AUTOMATION_WEBHOOK_URL).
 */
export async function runSystemAutomations(options?: { forcePayroll?: boolean }): Promise<AutomationResult> {
  await ensureStockLocationTables();
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const curY = now.getUTCFullYear();
  const curM = now.getUTCMonth() + 1;
  const curMonth = `${curY}-${String(curM).padStart(2, "0")}`;
  const curLabel = `${String(curM).padStart(2, "0")}/${curY}`;

  let recurrentGenerated = 0;
  let lowStockOrders = 0;
  let sstFlagged = 0;
  let payrollResultStr: string | null = null;
  let overdueOsCount = 0;
  let pendingQualityInspections = 0;
  let overdueRncsFlagged = 0;

  // 1. Automação de Despesas Recorrentes (ignora canceladas e marcadas como [NAO_RECORRENTE])
  try {
    const fixedExpenses = await prisma.financialEntry.findMany({
      where: {
        type: "DESPESA",
        category: { in: ["Aluguel", "Energia", "Internet/Telefone", "Software", "Contabilidade"] },
        status: { not: "CANCELADO" },
      },
      orderBy: { dueDate: "desc" },
    });

    const seenBase = new Set<string>();
    for (const exp of fixedExpenses) {
      if (exp.notes?.includes("[NAO_RECORRENTE]")) continue;
      const baseDesc = exp.description.replace(/\s*—\s*ref\..*$/i, "").trim();
      const dedupKey = `${exp.category}::${baseDesc.toLowerCase()}`;
      if (seenBase.has(dedupKey)) continue;
      seenBase.add(dedupKey);

      const existing = await prisma.financialEntry.findFirst({
        where: {
          category: exp.category,
          description: { contains: baseDesc },
          dueDate: {
            gte: new Date(Date.UTC(curY, curM - 1, 1)),
            lte: new Date(Date.UTC(curY, curM, 0, 23, 59, 59)),
          },
        },
      });

      if (!existing) {
        const dueDay = Math.min(28, exp.dueDate.getUTCDate() || 10);
        await prisma.financialEntry.create({
          data: {
            type: "DESPESA",
            description: `${baseDesc} — ref. ${curLabel}`,
            category: exp.category,
            amount: exp.amount,
            dueDate: new Date(Date.UTC(curY, curM - 1, dueDay)),
            status: "PENDENTE",
            notes: "Gerado automaticamente pela Automação de Despesas Fixas Recorrentes",
          },
        });
        recurrentGenerated++;
      }
    }
  } catch (err) {
    console.error("Erro na automação de despesas recorrentes:", err);
  }

  // 2. Automação de Compras para Produtos com Estoque Abaixo do Mínimo
  try {
    lowStockOrders = await ensureLowStockPurchaseDrafts();
  } catch (err) {
    console.error("Erro na automação de compras por estoque mínimo:", err);
  }

  // 3. Automação de SST (Atualiza status de EPIs e ASOs vencidos)
  try {
    const expiredSst = await prisma.employeeSafetyRecord.updateMany({
      where: {
        expiresAt: { lt: today },
        status: "VIGENTE",
      },
      data: {
        status: "VENCIDO",
      },
    });
    sstFlagged = expiredSst.count;
  } catch (err) {
    console.error("Erro na atualização de SST vencidos:", err);
  }

  // 4. Automação de Folha de Pagamento do Mês Atual (a partir do dia 25 no cron automático, ou imediata quando forcePayroll=true)
  try {
    const payrollCount = await prisma.financialEntry.count({
      where: {
        category: "Salários",
        description: { contains: `ref. ${curLabel}` },
      },
    });

    const shouldProcessPayroll = payrollCount === 0 && (options?.forcePayroll ? true : now.getUTCDate() >= 25);
    if (shouldProcessPayroll) {
      const res = await processPayrollForMonth(curMonth, { simulateRepIfEmpty: true });
      if (res.employees > 0) {
        payrollResultStr = `${res.employees} holerite(s) gerado(s) no Financeiro (Líquido Total: R$ ${res.totalNet.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})`;
      } else {
        payrollResultStr = "Nenhum colaborador ativo cadastrado para folha";
      }
    }
  } catch (err) {
    console.error("Erro no processamento automático de folha:", err);
  }

  // 5. Ordens de Serviço Atrasadas
  try {
    overdueOsCount = await prisma.serviceOrder.count({
      where: {
        status: { in: ["ABERTA", "EM_ANDAMENTO", "AGUARDANDO_PECA"] },
        expectedDate: { lt: today },
      },
    });
  } catch (err) {
    console.error("Erro ao verificar OS atrasadas:", err);
  }

  // 6. Automação de Contratos & Mensalidades Recorrentes
  let billedContractsCount = 0;
  try {
    const dueContracts = await prisma.contract.findMany({
      where: {
        status: "ATIVO",
        OR: [{ nextBillingDate: { lte: today } }, { nextBillingDate: null }],
      },
      include: { client: true },
    });

    for (const c of dueContracts) {
      const existing = await prisma.financialEntry.findFirst({
        where: {
          category: "Contratos / Assinaturas",
          description: { contains: `Contrato #${c.id}` },
          dueDate: {
            gte: new Date(Date.UTC(curY, curM - 1, 1)),
            lte: new Date(Date.UTC(curY, curM, 0, 23, 59, 59)),
          },
        },
      });

      if (!existing) {
        if (c.autoGenerateFinEntry) {
          const dueDay = Math.min(28, c.dueDay);
          await prisma.financialEntry.create({
            data: {
              type: "RECEITA",
              description: `Mensalidade Contrato #${c.id} — ${c.title} (${curLabel})`,
              category: "Contratos / Assinaturas",
              amount: c.amount,
              dueDate: new Date(Date.UTC(curY, curM - 1, dueDay)),
              status: "PENDENTE",
              notes: `Cliente: ${c.client.name} | Gerado automaticamente pela rotina de contratos`,
            },
          });
        }

        if (c.autoGenerateOS) {
          await prisma.serviceOrder.create({
            data: {
              clientId: c.clientId,
              equipment: `Contrato: ${c.title}`,
              status: "ABERTA",
              reportedIssue: c.osServiceDescription || `Manutenção periódica automática contrato #${c.id}`,
              laborCost: c.amount,
              total: c.amount,
              notes: `OS periódica automática (${curLabel})`,
            },
          });
        }

        const next = new Date(c.nextBillingDate || today);
        next.setMonth(next.getMonth() + 1);
        await prisma.contract.update({
          where: { id: c.id },
          data: {
            lastBilledAt: today,
            nextBillingDate: next,
          },
        });
        billedContractsCount++;
      }
    }
  } catch (err) {
    console.error("Erro na automação de contratos recorrentes:", err);
  }

  // 7. Monitoramento da Área de Qualidade (Inspeções pendentes & RNCs vencidas)
  try {
    const [pendingInsp, overdueRnc] = await Promise.all([
      prisma.qualityInspection.count({ where: { status: "PENDENTE" } }),
      prisma.nonConformity.count({
        where: { status: { not: "ENCERRADA" }, dueDate: { lt: today } },
      }),
    ]);
    pendingQualityInspections = pendingInsp;
    overdueRncsFlagged = overdueRnc;
  } catch (err) {
    console.error("Erro na verificação de qualidade:", err);
  }

  // Montagem do resumo executivo das ações realizadas
  const summary: string[] = [];

  if (recurrentGenerated > 0) {
    summary.push(`${recurrentGenerated} despesa(s) recorrente(s) fixa(s) projetada(s) no Financeiro.`);
  } else {
    summary.push(`Despesas fixas recorrentes: todas as despesas deste mês (${curLabel}) já estavam lançadas.`);
  }

  if (billedContractsCount > 0) {
    summary.push(`${billedContractsCount} mensalidade(s) de contrato(s) faturada(s) automaticamente.`);
  } else {
    summary.push("Contratos recorrentes: todas as mensalidades vigentes verificadas.");
  }

  if (lowStockOrders > 0) {
    summary.push(`${lowStockOrders} pedido(s) de compra gerado(s) em rascunho para reposição de estoque crítico.`);
  } else {
    summary.push("Estoque crítico: nenhum novo produto necessitando de pedido de reposição.");
  }

  if (payrollResultStr) {
    summary.push(`Folha de Pagamento ${curLabel}: ${payrollResultStr}.`);
  } else if (options?.forcePayroll || now.getUTCDate() >= 25) {
    summary.push(`Folha de Pagamento ${curLabel}: já está fechada e lançada no Financeiro.`);
  } else {
    summary.push(`Folha de Pagamento ${curLabel}: fechamento automático programado a partir do dia 25.`);
  }

  if (sstFlagged > 0) {
    summary.push(`${sstFlagged} item(ns) de EPI/ASO com prazo vencido atualizados no SST.`);
  } else {
    summary.push("Segurança do Trabalho (SST): todos os prazos verificados.");
  }

  if (overdueOsCount > 0) {
    summary.push(`${overdueOsCount} Ordem(ns) de Serviço com prazo ultrapassado sinalizadas.`);
  }

  if (pendingQualityInspections > 0 || overdueRncsFlagged > 0) {
    summary.push(
      `Qualidade (SGQ): ${pendingQualityInspections} inspeção(ões) pendente(s) e ${overdueRncsFlagged} RNC(s) com prazo vencido.`,
    );
  } else {
    summary.push("Qualidade (SGQ): nenhuma inspeção pendente ou RNC vencida.");
  }

  const result: AutomationResult = {
    timestamp: new Date().toISOString(),
    recurrentEntriesGenerated: recurrentGenerated,
    lowStockPurchasesSuggested: lowStockOrders,
    sstExpiredFlagged: sstFlagged,
    payrollProcessed: payrollResultStr,
    overdueTasksFlagged: overdueOsCount,
    pendingQualityInspections,
    overdueRncsFlagged,
    summary,
  };

  // 8. Disparo opcional para Webhook externo (WhatsApp / Slack / n8n)
  const webhookUrl = process.env.AUTOMATION_WEBHOOK_URL?.trim();
  if (webhookUrl) {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "erp.automation.summary", ...result }),
      signal: AbortSignal.timeout(5000),
    }).catch((err) => console.error("Falha ao enviar webhook de automação:", err));
  }

  revalidateTag("sidebar-alerts", "max");
  revalidatePath("/", "layout");
  revalidatePath("/financeiro");
  revalidatePath("/compras");
  revalidatePath("/estoque");
  revalidatePath("/funcionarios/folha");
  revalidatePath("/contratos");
  revalidatePath("/qualidade");

  return result;
}
