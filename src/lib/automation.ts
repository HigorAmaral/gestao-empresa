import { prisma } from "@/lib/prisma";
import { processPayrollForMonth } from "@/lib/payroll";
import { revalidateTag, revalidatePath } from "next/cache";

export type AutomationResult = {
  timestamp: string;
  recurrentEntriesGenerated: number;
  lowStockPurchasesSuggested: number;
  sstExpiredFlagged: number;
  payrollProcessed: string | null;
  overdueTasksFlagged: number;
  summary: string[];
};

/**
 * Motor Geral de Automações do Sistema:
 * 1. Projeção e lançamento automático de despesas recorrentes (Aluguel, Luz, Internet, Assinaturas);
 * 2. Análise inteligente de estoque mínimo e geração automática de pedidos de compra em rascunho;
 * 3. Varredura de vencimento de EPIs e ASOs de segurança do trabalho;
 * 4. Fechamento automático de Folha de Pagamento do mês (caso ainda não gerada);
 * 5. Verificação e alerta de ordens de serviço atrasadas.
 */
export async function runSystemAutomations(options?: { forcePayroll?: boolean }): Promise<AutomationResult> {
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

  // 1. Automação de Despesas Recorrentes (ex: Aluguel, Luz, Internet)
  // Localiza despesas pagas em meses anteriores que possuem indicação de recorrência e projeta para o mês atual se ainda não existirem
  try {
    const fixedExpenses = await prisma.financialEntry.findMany({
      where: {
        type: "DESPESA",
        category: { in: ["Aluguel", "Energia", "Internet/Telefone", "Software", "Contabilidade"] },
      },
      distinct: ["description", "category"],
    });

    for (const exp of fixedExpenses) {
      // Verifica se já existe lançamento dessa despesa no mês atual
      const baseDesc = exp.description.replace(/\s*—\s*ref\..*$/i, "").trim();
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
    const criticalProducts = await prisma.$queryRaw<
      { id: number; name: string; stock: number; minStock: number; costPrice: number; supplierId: number | null }[]
    >`
      SELECT id, name, stock, "minStock", "costPrice", "supplierId"
      FROM "Product"
      WHERE active = true AND stock <= "minStock"
    `;

    if (criticalProducts.length > 0) {
      // Agrupa por fornecedor
      const bySupplier = new Map<number | null, typeof criticalProducts>();
      for (const p of criticalProducts) {
        const supId = p.supplierId ?? null;
        const list = bySupplier.get(supId) || [];
        list.push(p);
        bySupplier.set(supId, list);
      }

      for (const [supplierId, items] of bySupplier.entries()) {
        // Verifica se já não foi criado um pedido pendente hoje para esse fornecedor
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
            const needQty = Math.max(1, (p.minStock * 2) - p.stock);
            return {
              productId: p.id,
              quantity: needQty,
              unitCost: p.costPrice || 10,
              total: Math.round(needQty * (p.costPrice || 10) * 100) / 100,
            };
          });

          const totalCost = purchaseItemsData.reduce((s, it) => s + it.total, 0);

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
          lowStockOrders++;
        }
      }
    }
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

  // 4. Automação de Folha de Pagamento do Mês Atual (se for >= dia 25 ou se forcePayroll for true)
  try {
    const payrollCount = await prisma.financialEntry.count({
      where: {
        category: "Salários",
        description: { contains: `ref. ${curLabel}` },
      },
    });

    const shouldProcessPayroll = payrollCount === 0 && (options?.forcePayroll ?? true);
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
        OR: [
          { nextBillingDate: { lte: today } },
          { nextBillingDate: null },
        ],
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

  // Montagem do resumo executivo das ações realizadas
  const summary: string[] = [];

  if (recurrentGenerated > 0) {
    summary.push(`${recurrentGenerated} despesa(s) recorrente(s) fixas projetadas no Financeiro.`);
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
  } else {
    summary.push(`Folha de Pagamento ${curLabel}: já está fechada e lançada no Financeiro.`);
  }

  if (sstFlagged > 0) {
    summary.push(`${sstFlagged} item(ns) de EPI/ASO com prazo vencido atualizados no SST.`);
  } else {
    summary.push("Segurança do Trabalho (SST): todos os prazos verificados.");
  }

  if (overdueOsCount > 0) {
    summary.push(`${overdueOsCount} Ordem(ns) de Serviço com prazo ultrapassado sinalizadas.`);
  }

  revalidatePath("/", "layout");
  revalidatePath("/financeiro");
  revalidatePath("/compras");
  revalidatePath("/estoque");
  revalidatePath("/funcionarios/folha");
  revalidatePath("/contratos");

  return {
    timestamp: new Date().toISOString(),
    recurrentEntriesGenerated: recurrentGenerated,
    lowStockPurchasesSuggested: lowStockOrders,
    sstExpiredFlagged: sstFlagged,
    payrollProcessed: payrollResultStr,
    overdueTasksFlagged: overdueOsCount,
    summary,
  };
}
