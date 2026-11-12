import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Building2, CalendarRange, FileUp, MessageCircle, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { pageParams, spStr } from "@/lib/form";
import { brl, fmtDate, todayUTC } from "@/lib/format";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { buildWhatsAppUrl, financialWhatsAppMessage } from "@/lib/whatsapp";
import { ExportCsvButton, FlashMessages, PageHeader, Pagination, StatusBadge } from "@/components/ui";
import { ConfirmButton } from "@/components/Forms";
import { FinanceToolsModals } from "@/components/FinanceToolsModals";
import { deleteEntry, markPaid } from "./actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function FinanceiroPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  await ensureStockLocationTables();
  const sp = await searchParams;
  const type = spStr(sp, "type");
  const status = spStr(sp, "status");
  const month = spStr(sp, "month");
  const bankIdStr = spStr(sp, "bankAccountId");
  const bankAccountId = bankIdStr ? Number(bankIdStr) : undefined;
  const q = spStr(sp, "q");
  const { page, skip, take, pageSize } = pageParams(sp);
  const today = todayUTC();

  let dueFilter: Prisma.DateTimeFilter | undefined;
  if (/^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    dueFilter = { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
  }

  const where: Prisma.FinancialEntryWhereInput = {
    ...(type && { type }),
    ...(bankAccountId && { bankAccountId }),
    ...(status === "VENCIDO" ? { status: "PENDENTE", dueDate: { lt: today, ...dueFilter } } : status ? { status } : {}),
    ...(status !== "VENCIDO" && dueFilter && { dueDate: dueFilter }),
    ...(q && { OR: [{ description: { contains: q } }, { category: { contains: q } }] }),
  };

  const sumWhere = (extra: Prisma.FinancialEntryWhereInput) =>
    prisma.financialEntry.aggregate({
      where: { ...extra, ...(dueFilter && { dueDate: dueFilter }), ...(bankAccountId && { bankAccountId }) },
      _sum: { amount: true },
    });

  const d30 = new Date(today.getTime() + 30 * 86400000);
  const d60 = new Date(today.getTime() + 60 * 86400000);
  const d90 = new Date(today.getTime() + 90 * 86400000);

  const [
    entries,
    total,
    recPaid,
    desPaid,
    recOpen,
    desOpen,
    overdue,
    bankAccounts,
    paidEntriesByBank,
    pendingNext90,
  ] = await Promise.all([
    prisma.financialEntry.findMany({
      where,
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      skip,
      take,
      include: {
        bankAccount: true,
        sale: { select: { client: { select: { name: true, phone: true } } } },
        serviceOrder: { select: { client: { select: { name: true, phone: true } } } },
      },
    }),
    prisma.financialEntry.count({ where }),
    sumWhere({ type: "RECEITA", status: "PAGO" }),
    sumWhere({ type: "DESPESA", status: "PAGO" }),
    sumWhere({ type: "RECEITA", status: "PENDENTE" }),
    sumWhere({ type: "DESPESA", status: "PENDENTE" }),
    prisma.financialEntry.aggregate({ where: { status: "PENDENTE", dueDate: { lt: today } }, _sum: { amount: true }, _count: true }),
    prisma.bankAccount.findMany({ where: { active: true }, orderBy: { id: "asc" } }),
    prisma.financialEntry.groupBy({
      by: ["bankAccountId", "type"],
      where: { status: "PAGO", bankAccountId: { not: null } },
      _sum: { amount: true },
    }),
    prisma.financialEntry.findMany({
      where: { status: "PENDENTE", dueDate: { lte: d90 } },
      select: { type: true, amount: true, dueDate: true },
    }),
  ]);

  const balance = (recPaid._sum.amount ?? 0) - (desPaid._sum.amount ?? 0);

  // Calcula saldo atual de cada conta bancária
  const bankAccountsSummary = bankAccounts.map((acc) => {
    const rec =
      paidEntriesByBank.find((g) => g.bankAccountId === acc.id && g.type === "RECEITA")?._sum.amount ?? 0;
    const des =
      paidEntriesByBank.find((g) => g.bankAccountId === acc.id && g.type === "DESPESA")?._sum.amount ?? 0;
    return {
      ...acc,
      currentBalance: acc.initialBalance + rec - des,
    };
  });

  const totalBankBalance = bankAccountsSummary.reduce((s, a) => s + a.currentBalance, 0);

  // Projeção de Fluxo de Caixa para 30, 60 e 90 dias
  const calcWindow = (limit: Date) => {
    let rec = 0;
    let des = 0;
    for (const p of pendingNext90) {
      if (p.dueDate <= limit) {
        if (p.type === "RECEITA") rec += p.amount;
        else des += p.amount;
      }
    }
    return { rec, des, projected: totalBankBalance + rec - des };
  };
  const proj30 = calcWindow(d30);
  const proj60 = calcWindow(d60);
  const proj90 = calcWindow(d90);

  const qs = new URLSearchParams(
    Object.entries(sp).filter(([k, v]) => typeof v === "string" && v && k !== "ok" && k !== "erro") as [string, string][],
  ).toString();
  const returnTo = "/financeiro" + (qs ? `?${qs}` : "");

  return (
    <>
      <PageHeader
        title="Financeiro & Conciliação"
        subtitle="Contas a pagar e receber, saldos bancários, conciliação OFX e fluxo de caixa projetado"
        actions={
          <>
            <Link className="btn secondary" href="/financeiro/conciliacao" title="Importar Extrato OFX do Banco">
              <FileUp size={15} /> Conciliação OFX
            </Link>
            <FinanceToolsModals accounts={bankAccountsSummary} />
            <ExportCsvButton entity="financeiro" />
            <Link className="btn" href="/financeiro/novo?type=RECEITA">
              <Plus size={15} /> Receita
            </Link>
            <Link className="btn secondary" href="/financeiro/novo?type=DESPESA">
              <Plus size={15} /> Despesa
            </Link>
          </>
        }
      />
      <FlashMessages sp={sp} />

      <div className="stats">
        <div className="stat success">
          <div className="label">Recebido{month && " no mês"}</div>
          <div className="value">{brl(recPaid._sum.amount)}</div>
        </div>
        <div className="stat danger">
          <div className="label">Pago{month && " no mês"}</div>
          <div className="value">{brl(desPaid._sum.amount)}</div>
        </div>
        <div className={`stat ${balance >= 0 ? "primary" : "danger"}`}>
          <div className="label">Saldo realizado</div>
          <div className="value">{brl(balance)}</div>
        </div>
        <div className="stat">
          <div className="label">A receber</div>
          <div className="value">{brl(recOpen._sum.amount)}</div>
        </div>
        <div className="stat">
          <div className="label">A pagar</div>
          <div className="value">{brl(desOpen._sum.amount)}</div>
        </div>
        <div className={`stat ${overdue._count ? "warning" : ""}`}>
          <div className="label">Vencidos (geral)</div>
          <div className="value">{brl(overdue._sum.amount)}</div>
          <div className="hint">
            <Link href="/financeiro?status=VENCIDO">{overdue._count} lançamento(s)</Link>
          </div>
        </div>
      </div>

      {/* Contas Bancárias & Fluxo de Caixa Projetado (30 / 60 / 90 dias) */}
      <div className="grid grid-2 mb">
        <div className="card">
          <div className="card-header">
            <h2>
              <Building2 size={16} /> Saldos em Contas & Carteiras ({brl(totalBankBalance)})
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {bankAccountsSummary.map((acc) => (
              <div
                key={acc.id}
                className="row between"
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "var(--surface-subtle)",
                  border: "1px solid var(--border)",
                }}
              >
                <div>
                  <Link href={`/financeiro?bankAccountId=${acc.id}`} className="bold" style={{ fontSize: 13.5 }}>
                    {acc.name}
                  </Link>
                  <div className="small muted">
                    {acc.bankName || acc.type} {acc.accountNumber ? `• C/C ${acc.accountNumber}` : ""}
                  </div>
                </div>
                <div className="bold" style={{ fontSize: 14.5 }}>
                  {brl(acc.currentBalance)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>
              <CalendarRange size={16} /> Fluxo de Caixa Projetado (30 / 60 / 90 dias)
            </h2>
            <Link href="/relatorios" className="small">
              Ver DRE Completo →
            </Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Horizonte</th>
                  <th className="num">(+) A Receber</th>
                  <th className="num">(-) A Pagar</th>
                  <th className="num">Saldo Projetado</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="bold">Próximos 30 dias</td>
                  <td className="num text-success">{brl(proj30.rec)}</td>
                  <td className="num text-danger">-{brl(proj30.des)}</td>
                  <td className="num bold">{brl(proj30.projected)}</td>
                </tr>
                <tr>
                  <td className="bold">Próximos 60 dias</td>
                  <td className="num text-success">{brl(proj60.rec)}</td>
                  <td className="num text-danger">-{brl(proj60.des)}</td>
                  <td className="num bold">{brl(proj60.projected)}</td>
                </tr>
                <tr>
                  <td className="bold">Próximos 90 dias</td>
                  <td className="num text-success">{brl(proj90.rec)}</td>
                  <td className="num text-danger">-{brl(proj90.des)}</td>
                  <td className="num bold">{brl(proj90.projected)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <form className="filters">
        <input className="grow" name="q" placeholder="Buscar descrição ou categoria..." defaultValue={q} />
        <select name="type" defaultValue={type}>
          <option value="">Receitas e despesas</option>
          <option value="RECEITA">Receitas</option>
          <option value="DESPESA">Despesas</option>
        </select>
        <select name="status" defaultValue={status}>
          <option value="">Todos os status</option>
          <option value="PENDENTE">Pendente</option>
          <option value="VENCIDO">Vencido</option>
          <option value="PAGO">Pago</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
        <select name="bankAccountId" defaultValue={bankIdStr}>
          <option value="">Todas as contas</option>
          {bankAccountsSummary.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name}
            </option>
          ))}
        </select>
        <input type="month" name="month" defaultValue={month} title="Mês de vencimento" />
        <button className="btn secondary">Filtrar</button>
        <Link className="btn secondary" href="/financeiro">
          Limpar
        </Link>
      </form>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Vencimento</th>
                <th>Descrição</th>
                <th>Categoria / Conta</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Pago em</th>
                <th className="num">Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const isOverdue = e.status === "PENDENTE" && e.dueDate < today;
                return (
                  <tr key={e.id}>
                    <td className={isOverdue ? "text-danger bold" : ""}>{fmtDate(e.dueDate)}</td>
                    <td>
                      <Link href={`/financeiro/${e.id}`}>{e.description}</Link>
                      {e.saleId && (
                        <div className="small">
                          <Link href={`/vendas/${e.saleId}`}>ver venda</Link>
                        </div>
                      )}
                      {e.purchaseId && (
                        <div className="small">
                          <Link href={`/compras/${e.purchaseId}`}>ver compra</Link>
                        </div>
                      )}
                      {e.serviceOrderId && (
                        <div className="small">
                          <Link href={`/os/${e.serviceOrderId}`}>ver OS</Link>
                        </div>
                      )}
                    </td>
                    <td>
                      <div>{e.category ?? "—"}</div>
                      {e.bankAccount && <div className="small muted">{e.bankAccount.name}</div>}
                    </td>
                    <td>
                      <StatusBadge status={e.type} />
                    </td>
                    <td>
                      <StatusBadge status={isOverdue ? "VENCIDO" : e.status} />
                    </td>
                    <td>{e.paidAt ? new Date(e.paidAt).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className={`num bold ${e.type === "RECEITA" ? "text-success" : "text-danger"}`}>
                      {e.type === "DESPESA" ? "− " : ""}
                      {brl(e.amount)}
                    </td>
                    <td className="actions">
                      {e.status === "PENDENTE" && e.type === "RECEITA" && (
                        <a
                          className="btn sm secondary"
                          href={buildWhatsAppUrl(
                            e.sale?.client?.phone ?? e.serviceOrder?.client?.phone,
                            financialWhatsAppMessage({
                              description: e.description,
                              amount: e.amount,
                              dueDate: e.dueDate,
                              clientName: e.sale?.client?.name ?? e.serviceOrder?.client?.name,
                            }),
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Enviar lembrete de cobrança no WhatsApp"
                        >
                          <MessageCircle size={13} /> Cobrar
                        </a>
                      )}
                      {e.status === "PENDENTE" && (
                        <ConfirmButton
                          action={markPaid.bind(null, e.id, returnTo)}
                          label={e.type === "RECEITA" ? "Receber" : "Pagar"}
                          className="btn sm success"
                        />
                      )}
                      <ConfirmButton
                        action={deleteEntry.bind(null, e.id)}
                        label="Excluir"
                        className="btn sm danger"
                        confirmText={`Excluir o lançamento "${e.description}"?`}
                      />
                    </td>
                  </tr>
                );
              })}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty">
                    Nenhum lançamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination basePath="/financeiro" sp={sp} page={page} pageSize={pageSize} total={total} />
      </div>
    </>
  );
}
