import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, Plus, Printer, ShoppingCart, Wrench } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { brl, fmtDate } from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { PageHeader, StatusBadge } from "@/components/ui";
import { ActionForm } from "@/components/Forms";
import { PartyFields } from "@/components/PartyFields";
import { saveClient } from "../actions";

export default async function ClienteFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "novo";
  const client = isNew ? null : await prisma.client.findUnique({ where: { id: Number(id) } });
  if (!isNew && !client) notFound();

  const [sales, serviceOrders, openReceivables] = client
    ? await Promise.all([
        prisma.sale.findMany({
          where: { clientId: client.id },
          orderBy: { date: "desc" },
          take: 15,
        }),
        prisma.serviceOrder.findMany({
          where: { clientId: client.id },
          orderBy: { openedAt: "desc" },
          take: 15,
        }),
        prisma.financialEntry.aggregate({
          where: {
            type: "RECEITA",
            status: "PENDENTE",
            OR: [{ sale: { clientId: client.id } }, { serviceOrder: { clientId: client.id } }],
          },
          _sum: { amount: true },
          _count: true,
        }),
      ])
    : [[], [], { _sum: { amount: 0 }, _count: 0 }];

  const confirmedSales = sales.filter((s) => s.status === "CONFIRMADA");
  const totalSalesAmount = confirmedSales.reduce((acc, s) => acc + s.total, 0);
  const avgTicket = confirmedSales.length > 0 ? totalSalesAmount / confirmedSales.length : 0;

  const completedOs = serviceOrders.filter((o) => o.status === "CONCLUIDA");
  const totalOsAmount = completedOs.reduce((acc, o) => acc + o.total, 0);
  const openOsCount = serviceOrders.filter((o) =>
    ["ABERTA", "EM_ANDAMENTO", "AGUARDANDO_PECA"].includes(o.status),
  ).length;

  const waUrl = client
    ? buildWhatsAppUrl(client.phone, `Olá, *${client.name}*! Tudo bem? Entramos em contato pela empresa.`)
    : null;

  return (
    <>
      <PageHeader
        title={isNew ? "Novo cliente" : client!.name}
        subtitle={isNew ? "Preencha os dados do cliente" : "Visão 360º do cliente, histórico de compras e ordens de serviço"}
        actions={
          client && (
            <>
              {waUrl && (
                <a className="btn secondary" href={waUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={15} /> WhatsApp
                </a>
              )}
              <Link className="btn secondary" href={`/os/novo?clientId=${client.id}`}>
                <Wrench size={15} /> Nova OS
              </Link>
              <Link className="btn" href={`/vendas/novo?clientId=${client.id}`}>
                <Plus size={15} /> Nova Venda
              </Link>
            </>
          )
        }
      />

      {client && (
        <div className="stats">
          <div className="stat primary">
            <div className="label">Total em Compras</div>
            <div className="value">{brl(totalSalesAmount)}</div>
            <div className="hint">{confirmedSales.length} venda(s) confirmada(s)</div>
          </div>
          <div className="stat">
            <div className="label">Ticket Médio</div>
            <div className="value">{brl(avgTicket)}</div>
            <div className="hint">por pedido confirmado</div>
          </div>
          <div className="stat">
            <div className="label">Ordens de Serviço</div>
            <div className="value">{brl(totalOsAmount)}</div>
            <div className="hint">
              {completedOs.length} concluída(s) • {openOsCount} em aberto
            </div>
          </div>
          <div className="stat">
            <div className="label">Títulos em Aberto</div>
            <div className="value">{brl(openReceivables._sum.amount)}</div>
            <div className="hint">{openReceivables._count} parcela(s) pendente(s)</div>
          </div>
        </div>
      )}

      <div className="card">
        <ActionForm
          action={saveClient.bind(null, client?.id ?? null)}
          extraActions={
            <Link className="btn secondary" href="/clientes">
              Voltar
            </Link>
          }
        >
          <PartyFields data={client} />
        </ActionForm>
      </div>

      {client && (
        <div className="grid grid-2 mt">
          <div className="card flush">
            <div className="card-header">
              <h2>
                <ShoppingCart size={16} /> Histórico de Vendas ({sales.length})
              </h2>
              <Link className="btn sm secondary" href={`/vendas/novo?clientId=${client.id}`}>
                <Plus size={13} /> Vender
              </Link>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nº</th>
                    <th>Data</th>
                    <th>Pagamento</th>
                    <th>Status</th>
                    <th className="num">Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s.id}>
                      <td className="bold">
                        <Link href={`/vendas/${s.id}`}>#{s.id}</Link>
                      </td>
                      <td>{fmtDate(s.date)}</td>
                      <td className="small muted">
                        {s.paymentMethod ?? "—"}
                        {s.installments > 1 ? ` (${s.installments}x)` : ""}
                      </td>
                      <td>
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="num bold">{brl(s.total)}</td>
                      <td className="actions">
                        <Link className="btn sm secondary" href={`/vendas/${s.id}/recibo`} title="Imprimir recibo">
                          <Printer size={13} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {sales.length === 0 && (
                    <tr>
                      <td colSpan={6} className="empty">
                        Nenhuma venda registrada para este cliente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card flush">
            <div className="card-header">
              <h2>
                <Wrench size={16} /> Ordens de Serviço ({serviceOrders.length})
              </h2>
              <Link className="btn sm secondary" href={`/os/novo?clientId=${client.id}`}>
                <Plus size={13} /> Abrir OS
              </Link>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>OS</th>
                    <th>Equipamento</th>
                    <th>Data</th>
                    <th>Status</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceOrders.map((os) => (
                    <tr key={os.id}>
                      <td className="bold">
                        <Link href={`/os/${os.id}`}>#{os.id}</Link>
                      </td>
                      <td>
                        <Link href={`/os/${os.id}`}>{os.equipment}</Link>
                      </td>
                      <td>{fmtDate(os.openedAt)}</td>
                      <td>
                        <StatusBadge status={os.status} />
                      </td>
                      <td className="num bold">{brl(os.total)}</td>
                    </tr>
                  ))}
                  {serviceOrders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="empty">
                        Nenhuma Ordem de Serviço para este cliente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
