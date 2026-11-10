import Link from "next/link";
import type { Prisma } from "@prisma/client";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Cpu,
  Factory,
  Layers,
  MapPin,
  Package,
  Plus,
  Printer,
  Search,
  User,
  Wrench,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { pageParams, spStr } from "@/lib/form";
import { fmtDate, fmtDateTime, num } from "@/lib/format";
import { ExportCsvButton, FlashMessages, PageHeader, Pagination, StatusBadge } from "@/components/ui";
import { ensureStockLocationTables } from "@/lib/stock-location";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ProducaoPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = spStr(sp, "q");
  const status = spStr(sp, "status");
  const priority = spStr(sp, "priority");
  const { page, skip, take, pageSize } = pageParams(sp);

  await ensureStockLocationTables();

  const where: Prisma.ProductionOrderWhereInput = {
    ...(q && {
      OR: [
        { code: { contains: q } },
        { machine: { contains: q } },
        { operatorName: { contains: q } },
        { product: { name: { contains: q } } },
        { notes: { contains: q } },
      ],
    }),
    ...(status && { status }),
    ...(priority && { priority }),
  };

  const [orders, total, plannedCount, inProductionCount, completedCount, activeMachines] = await Promise.all([
    prisma.productionOrder.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
      include: {
        product: true,
        user: true,
        items: {
          include: {
            product: true,
            location: true,
          },
        },
      },
    }),
    prisma.productionOrder.count({ where }),
    prisma.productionOrder.count({ where: { status: "PLANEJADA" } }),
    prisma.productionOrder.count({ where: { status: "EM_PRODUCAO" } }),
    prisma.productionOrder.count({ where: { status: "CONCLUIDA" } }),
    prisma.productionOrder.groupBy({
      by: ["machine"],
      where: { status: { in: ["PLANEJADA", "EM_PRODUCAO"] } },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Ordens de Produção (OP)"
        subtitle="Separação de insumos no estoque, acompanhamento de ordens e entrega nas máquinas de trabalho"
        actions={
          <>
            <ExportCsvButton entity="producao" />
            <Link className="btn" href="/producao/novo">
              <Plus size={16} /> Nova OP
            </Link>
          </>
        }
      />

      <FlashMessages sp={sp} />

      {/* Estatísticas Rápidas */}
      <div className="stats">
        <div className="stat warning">
          <div className="label">OPs Planejadas</div>
          <div className="value">{plannedCount}</div>
          <div className="hint">Aguardando separação / início</div>
        </div>
        <div className="stat primary">
          <div className="label">Em Produção</div>
          <div className="value">{inProductionCount}</div>
          <div className="hint">Rodando nas máquinas</div>
        </div>
        <div className="stat">
          <div className="label">Concluídas</div>
          <div className="value">{completedCount}</div>
          <div className="hint">Fabricação finalizada</div>
        </div>
        <div className="stat">
          <div className="label">Máquinas Ocupadas</div>
          <div className="value">{activeMachines.length}</div>
          <div className="hint">Postos com ordens ativas</div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <form className="filters" method="get">
        <div className="input-icon" style={{ flex: 1 }}>
          <Search size={16} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por código OP, produto, máquina de entrega ou operador..."
          />
        </div>
        <select name="status" defaultValue={status}>
          <option value="">Todos os status</option>
          <option value="PLANEJADA">Planejada</option>
          <option value="EM_PRODUCAO">Em Produção</option>
          <option value="CONCLUIDA">Concluída</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
        <select name="priority" defaultValue={priority}>
          <option value="">Todas as prioridades</option>
          <option value="BAIXA">Baixa</option>
          <option value="NORMAL">Normal</option>
          <option value="ALTA">Alta</option>
          <option value="URGENTE">Urgente</option>
        </select>
        <button type="submit" className="btn secondary">
          Filtrar
        </button>
        {(q || status || priority) && (
          <Link href="/producao" className="btn ghost">
            Limpar
          </Link>
        )}
      </form>

      {/* Tabela de Ordens de Produção */}
      <div className="card table-responsive">
        <table>
          <thead>
            <tr>
              <th>Código OP</th>
              <th>Produto a Fabricar</th>
              <th style={{ textAlign: "right" }}>Qtd</th>
              <th>Máquina de Destino</th>
              <th>Operador</th>
              <th>Prioridade</th>
              <th>Status</th>
              <th>Previsão Entrega</th>
              <th style={{ textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "36px 0", color: "var(--muted)" }}>
                  <Factory size={36} style={{ margin: "0 auto 8px", opacity: 0.35, display: "block" }} />
                  Nenhuma ordem de produção cadastrada até o momento.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/producao/${o.id}`} style={{ fontWeight: 600, fontFamily: "monospace" }}>
                      {o.code}
                    </Link>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      {o.items.length} insumo(s) na lista
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{o.product.name}</div>
                    {o.product.sku && <div style={{ fontSize: 11, color: "var(--muted)" }}>SKU: {o.product.sku}</div>}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>
                    {num(o.quantity)} {o.product.unit}
                  </td>
                  <td>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        background: "var(--bg-subtle, #f4f4f5)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        padding: "3px 8px",
                        fontWeight: 600,
                        fontSize: 12.5,
                      }}
                    >
                      <Factory size={13} />
                      {o.machine}
                    </span>
                  </td>
                  <td>
                    {o.operatorName ? (
                      <span style={{ fontSize: 13 }}>{o.operatorName}</span>
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>Não atribuído</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={o.priority} />
                  </td>
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                  <td>
                    {o.deliveryDate ? (
                      <span style={{ fontSize: 12.5 }}>{fmtDate(o.deliveryDate)}</span>
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className="row justify-end" style={{ gap: 6 }}>
                      <Link
                        className="btn secondary"
                        style={{ padding: "4px 8px", fontSize: 12 }}
                        href={`/producao/${o.id}/recibo`}
                        title="Ficha de Separação e Entrega na Máquina (Imprimir)"
                      >
                        <Printer size={13} /> Ficha da Máquina
                      </Link>
                      <Link
                        className="btn ghost"
                        style={{ padding: "4px 8px", fontSize: 12 }}
                        href={`/producao/${o.id}`}
                      >
                        Ver OP →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination basePath="/producao" sp={sp} page={page} pageSize={pageSize} total={total} />
    </>
  );
}
