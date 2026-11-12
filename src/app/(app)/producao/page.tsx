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
  Tag,
  User,
  Wrench,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { pageParams, spStr } from "@/lib/form";
import { fmtDate, fmtDateTime, num, brl } from "@/lib/format";
import { ExportCsvButton, FlashMessages, PageHeader, Pagination, StatusBadge } from "@/components/ui";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { MachinesBoardView, type MachineWithOrders } from "./MachinesBoardView";
import { generateMrpPurchaseOrderAction } from "./actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ProducaoPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tab = spStr(sp, "tab") || "ordens";
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

  const [
    orders,
    total,
    plannedCount,
    inProductionCount,
    completedCount,
    activeMachines,
    allMachines,
    activeOrdersForBoard,
  ] = await Promise.all([
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
    prisma.productionMachine.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.productionOrder.findMany({
      where: { status: { in: ["PLANEJADA", "EM_PRODUCAO"] } },
      orderBy: [{ status: "desc" }, { createdAt: "asc" }],
      include: {
        product: true,
        items: { include: { product: true } },
      },
    }),
  ]);

  // Cálculo MRP (Planejamento de Necessidade de Materiais) para todas as OPs ativas
  const mrpMap = new Map<
    number,
    {
      productId: number;
      sku: string;
      name: string;
      unit: string;
      stock: number;
      costPrice: number;
      totalRequired: number;
      ordersCodes: string[];
    }
  >();

  for (const op of activeOrdersForBoard) {
    for (const it of op.items) {
      const cur = mrpMap.get(it.productId) ?? {
        productId: it.productId,
        sku: it.product.sku,
        name: it.product.name,
        unit: it.product.unit,
        stock: it.product.stock,
        costPrice: it.product.costPrice > 0 ? it.product.costPrice : it.product.salePrice * 0.6,
        totalRequired: 0,
        ordersCodes: [],
      };
      cur.totalRequired += it.quantityRequired;
      if (!cur.ordersCodes.includes(op.code)) cur.ordersCodes.push(op.code);
      mrpMap.set(it.productId, cur);
    }
  }

  const mrpRows = [...mrpMap.values()]
    .map((r) => ({
      ...r,
      shortage: Math.max(0, Number((r.totalRequired - r.stock).toFixed(4))),
    }))
    .sort((a, b) => b.shortage - a.shortage);

  const mrpShortagesCount = mrpRows.filter((r) => r.shortage > 0).length;

  // Monta as máquinas com ordens ativas para o Quadro Visual
  const machinesWithOrders: MachineWithOrders[] = allMachines.map((m) => {
    const ordersForMachine = activeOrdersForBoard.filter((o) => o.machine.trim().toLowerCase() === m.name.trim().toLowerCase());
    const inProd = ordersForMachine.find((o) => o.status === "EM_PRODUCAO");
    const planned = ordersForMachine.filter((o) => o.status === "PLANEJADA");
    const activeOrder = inProd || (planned.length > 0 ? planned[0] : null);
    const queuedOrders = inProd ? planned : planned.slice(1);

    return {
      id: m.id,
      name: m.name,
      code: m.code,
      category: m.category,
      location: m.location,
      active: m.active,
      activeOrder: activeOrder
        ? {
            id: activeOrder.id,
            code: activeOrder.code,
            quantity: activeOrder.quantity,
            operatorName: activeOrder.operatorName,
            status: activeOrder.status,
            priority: activeOrder.priority,
            startDate: activeOrder.startDate,
            deliveryDate: activeOrder.deliveryDate,
            itemsCount: activeOrder.items.length,
            product: {
              id: activeOrder.product.id,
              name: activeOrder.product.name,
              sku: activeOrder.product.sku,
              unit: activeOrder.product.unit,
            },
          }
        : null,
      queuedOrders: queuedOrders.map((q) => ({
        id: q.id,
        code: q.code,
        quantity: q.quantity,
        product: {
          name: q.product.name,
          unit: q.product.unit,
        },
      })),
    };
  });

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

      {/* Abas de Navegação: OPs vs Quadro de Máquinas vs MRP */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          borderBottom: "1px solid var(--border)",
          paddingBottom: 12,
          marginBottom: 20,
        }}
      >
        <Link
          href="/producao"
          className={`btn ${tab !== "maquinas" && tab !== "mrp" ? "" : "ghost"}`}
          style={{ fontSize: 13 }}
        >
          <Layers size={15} /> Ordens de Produção ({total})
        </Link>
        <Link
          href="/producao?tab=maquinas"
          className={`btn ${tab === "maquinas" ? "" : "ghost"}`}
          style={{ fontSize: 13 }}
        >
          <Factory size={15} /> Quadro de Máquinas & Chão de Fábrica ({allMachines.length})
        </Link>
        <Link
          href="/producao?tab=mrp"
          className={`btn ${tab === "mrp" ? "" : "ghost"}`}
          style={{ fontSize: 13 }}
        >
          <Package size={15} /> MRP — Necessidade de Matéria-Prima ({mrpRows.length})
          {mrpShortagesCount > 0 && (
            <span className="badge danger" style={{ marginLeft: 4 }}>
              {mrpShortagesCount} falta(s)
            </span>
          )}
        </Link>
      </div>

      {tab === "maquinas" ? (
        <MachinesBoardView machines={machinesWithOrders} />
      ) : tab === "mrp" ? (
        <div className="card flush">
          <div className="card-header" style={{ flexWrap: "wrap" }}>
            <div>
              <h2>
                <Package size={18} /> MRP — Planejamento de Necessidades de Materiais ({activeOrdersForBoard.length} OP(s) ativa(s))
              </h2>
              <p className="small muted" style={{ margin: "4px 0 0" }}>
                Cálculo automático dos insumos exigidos por todas as OPs Planejadas e Em Produção comparado ao saldo atual em estoque.
              </p>
            </div>
            {mrpShortagesCount > 0 && (
              <form action={generateMrpPurchaseOrderAction}>
                <button type="submit" className="btn">
                  <Plus size={15} /> Gerar Pedido de Compra dos Faltantes ({mrpShortagesCount})
                </button>
              </form>
            )}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Matéria-Prima / Insumo</th>
                  <th>OPs Vinculadas</th>
                  <th className="num">Exigido Total</th>
                  <th className="num">Estoque Atual</th>
                  <th className="num">Déficit (Falta Comprar)</th>
                  <th className="num">Custo Estimado</th>
                  <th>Status MRP</th>
                </tr>
              </thead>
              <tbody>
                {mrpRows.map((row) => (
                  <tr key={row.productId}>
                    <td className="small bold muted">{row.sku}</td>
                    <td className="bold">
                      <Link href={`/produtos/${row.productId}`}>{row.name}</Link>
                    </td>
                    <td className="small muted">{row.ordersCodes.join(", ")}</td>
                    <td className="num bold">
                      {num(row.totalRequired)} {row.unit}
                    </td>
                    <td className="num">
                      {num(row.stock)} {row.unit}
                    </td>
                    <td className={`num bold ${row.shortage > 0 ? "text-danger" : "text-success"}`}>
                      {row.shortage > 0 ? `${num(row.shortage)} ${row.unit}` : "0"}
                    </td>
                    <td className="num">{row.shortage > 0 ? brl(row.shortage * row.costPrice) : "—"}</td>
                    <td>
                      {row.shortage > 0 ? (
                        <span className="badge danger">Comprar Insumo</span>
                      ) : (
                        <span className="badge success">Estoque Suficiente</span>
                      )}
                    </td>
                  </tr>
                ))}
                {mrpRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="empty">
                      Nenhuma OP Planejada ou Em Produção no momento para cálculo de MRP.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
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
                            href={`/producao/${o.id}/etiquetas`}
                            title="Imprimir Etiquetas do Lote"
                          >
                            <Tag size={13} />
                          </Link>
                          <Link
                            className="btn secondary"
                            style={{ padding: "4px 8px", fontSize: 12 }}
                            href={`/producao/${o.id}/recibo`}
                            title="Ficha de Separação e Entrega na Máquina (Imprimir)"
                          >
                            <Printer size={13} /> Ficha
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
      )}
    </>
  );
}
