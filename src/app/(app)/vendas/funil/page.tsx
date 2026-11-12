import Link from "next/link";
import { ArrowLeft, Clock, MessageCircle, Phone, Plus, ShoppingCart, Sparkles, TrendingUp, UserX } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { brl, fmtDate } from "@/lib/format";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { PageHeader } from "@/components/ui";
import { CrmPipelineView } from "./CrmPipelineView";
import { createCrmOpportunityAction } from "./actions";

export default async function FunilVendasPage() {
  await requireAdmin("vendas");
  await ensureStockLocationTables();

  const fortyFiveDaysAgo = new Date(Date.now() - 45 * 86400000);

  const [opportunities, clients, allClientsWithSales] = await Promise.all([
    prisma.sale.findMany({
      where: {
        OR: [
          { status: "ORCAMENTO" },
          { pipelineStage: { in: ["NOVO_LEAD", "CONTATO", "PROPOSTA", "NEGOCIACAO", "FECHADO"] } },
        ],
      },
      include: {
        client: true,
        user: true,
        items: { include: { product: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 150,
    }),
    prisma.client.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true },
    }),
    prisma.client.findMany({
      where: { active: true },
      include: {
        sales: {
          where: { status: "CONFIRMADA" },
          orderBy: { date: "desc" },
          take: 1,
        },
        _count: {
          select: { sales: { where: { status: "CONFIRMADA" } } },
        },
      },
    }),
  ]);

  // Clientes inativos que já compraram antes mas estão há mais de 45 dias sem novas compras
  const inactiveClients = allClientsWithSales
    .filter((c) => {
      const last = c.sales[0];
      return last && last.date < fortyFiveDaysAgo;
    })
    .sort((a, b) => (b.sales[0]?.date.getTime() || 0) - (a.sales[0]?.date.getTime() || 0))
    .slice(0, 15);

  return (
    <>
      <PageHeader
        title="Funil de Vendas & CRM (Pipeline Comercial)"
        subtitle="Acompanhe oportunidades desde o primeiro contato até o fechamento de propostas e reativação de clientes inativos."
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/vendas" className="btn secondary">
              <ArrowLeft size={16} /> Voltar para Vendas
            </Link>
          </div>
        }
      />

      {/* Formulário Rápido de Nova Oportunidade */}
      <div className="card mb">
        <h2 className="mb" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Plus size={18} /> Nova Oportunidade / Lead no Funil
        </h2>
        <form action={createCrmOpportunityAction}>
          <div className="form-grid">
            <div className="field s4">
              <label>Cliente / Empresa *</label>
              <select name="clientId" required>
                <option value="">Selecione o cliente...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="field s3">
              <label>Valor Estimado (R$)</label>
              <input type="number" step="0.01" min="0" name="amount" placeholder="Ex: 2.500,00" />
            </div>
            <div className="field s3">
              <label>Etapa Inicial no Funil *</label>
              <select name="stage" defaultValue="NOVO_LEAD">
                <option value="NOVO_LEAD">1. Novo Lead</option>
                <option value="CONTATO">2. Contato Feito</option>
                <option value="PROPOSTA">3. Proposta Enviada</option>
                <option value="NEGOCIACAO">4. Em Negociação</option>
              </select>
            </div>
            <div className="field s2" style={{ paddingTop: 24 }}>
              <button type="submit" className="btn" style={{ width: "100%", justifyContent: "center" }}>
                <Plus size={14} /> Adicionar
              </button>
            </div>
            <div className="field s12">
              <label>Anotações do Lead / O que o cliente precisa?</label>
              <input name="notes" placeholder="Ex: Interessado em peças para frota, pediu orçamento para segunda-feira" />
            </div>
          </div>
        </form>
      </div>

      {/* Kanban Board do Pipeline */}
      <CrmPipelineView
        opportunities={opportunities.map((o) => ({
          id: o.id,
          stage: o.pipelineStage || (o.status === "CONFIRMADA" ? "FECHADO" : "PROPOSTA"),
          total: o.total,
          status: o.status,
          date: o.date.toISOString(),
          notes: o.notes,
          client: o.client
            ? {
                id: o.client.id,
                name: o.client.name,
                phone: o.client.phone,
              }
            : null,
        }))}
      />

      {/* Seção de Clientes Inativos para Reativação Comercial */}
      <div className="card flush mt">
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <UserX size={18} /> Reativação Comercial: Clientes sem Compras há mais de 45 dias ({inactiveClients.length})
          </h2>
          <div className="small muted" style={{ marginTop: 4 }}>
            Clientes valiosos que já compraram na sua empresa mas estão sumidos. Envie uma mensagem no WhatsApp com 1 clique para reengajá-los.
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Telefone</th>
                <th>Última Compra</th>
                <th className="num">Histórico de Pedidos</th>
                <th className="actions">Ação Rápida</th>
              </tr>
            </thead>
            <tbody>
              {inactiveClients.map((c) => {
                const last = c.sales[0];
                const msg = `Olá, *${c.name}*! Tudo bem?\n\nFaz algum tempo que não nos falamos e gostaríamos de saber se está precisando de reposição ou novos produtos/serviços. Estamos com condições especiais nesta semana!`;
                const waUrl = buildWhatsAppUrl(c.phone, msg);

                return (
                  <tr key={c.id}>
                    <td className="bold">
                      <Link href={`/clientes/${c.id}`}>{c.name}</Link>
                    </td>
                    <td>{c.phone || "—"}</td>
                    <td>
                      <div>{last ? fmtDate(last.date) : "—"}</div>
                      <div className="small muted">
                        {last ? `${Math.floor((Date.now() - last.date.getTime()) / 86400000)} dias atrás` : ""}
                      </div>
                    </td>
                    <td className="num bold">{c._count.sales} compra(s)</td>
                    <td className="actions">
                      {waUrl ? (
                        <a
                          className="btn sm"
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Enviar mensagem amigável no WhatsApp para reativação"
                        >
                          <MessageCircle size={13} /> Reativar no WhatsApp
                        </a>
                      ) : (
                        <span className="small muted">Sem telefone</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {inactiveClients.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    Excelente! Todos os seus clientes ativos compraram nos últimos 45 dias.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
