import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { MessageCircle, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { pageParams, spStr } from "@/lib/form";
import { brl, fmtDate, todayUTC } from "@/lib/format";
import { buildWhatsAppUrl, financialWhatsAppMessage } from "@/lib/whatsapp";
import { ExportCsvButton, FlashMessages, PageHeader, Pagination, StatusBadge } from "@/components/ui";
import { ConfirmButton } from "@/components/Forms";
import { deleteEntry, markPaid } from "./actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function FinanceiroPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const type = spStr(sp, "type");
  const status = spStr(sp, "status");
  const month = spStr(sp, "month");
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
    ...(status === "VENCIDO" ? { status: "PENDENTE", dueDate: { lt: today, ...dueFilter } } : status ? { status } : {}),
    ...(status !== "VENCIDO" && dueFilter && { dueDate: dueFilter }),
    ...(q && { OR: [{ description: { contains: q } }, { category: { contains: q } }] }),
  };

  const sumWhere = (extra: Prisma.FinancialEntryWhereInput) =>
    prisma.financialEntry.aggregate({ where: { ...extra, ...(dueFilter && { dueDate: dueFilter }) }, _sum: { amount: true } });

  const [entries, total, recPaid, desPaid, recOpen, desOpen, overdue] = await Promise.all([
    prisma.financialEntry.findMany({
      where,
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      skip,
      take,
      include: {
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
  ]);

  const balance = (recPaid._sum.amount ?? 0) - (desPaid._sum.amount ?? 0);
  const qs = new URLSearchParams(
    Object.entries(sp).filter(([k, v]) => typeof v === "string" && v && k !== "ok" && k !== "erro") as [string, string][],
  ).toString();
  const returnTo = "/financeiro" + (qs ? `?${qs}` : "");

  return (
    <>
      <PageHeader
        title="Financeiro"
        subtitle="Contas a pagar, contas a receber e fluxo de caixa"
        actions={
          <>
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
                <th>Categoria</th>
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
                    <td>{e.category ?? "—"}</td>
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
