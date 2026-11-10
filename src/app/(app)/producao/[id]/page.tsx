import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Factory,
  Layers,
  MapPin,
  Package,
  Play,
  Printer,
  User,
  Wrench,
  XCircle,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtDate, fmtDateTime, num } from "@/lib/format";
import { FlashMessages, PageHeader, StatusBadge } from "@/components/ui";
import { ConfirmButton } from "@/components/Forms";
import { ensureStockLocationTables } from "@/lib/stock-location";
import {
  cancelProductionOrder,
  completeProductionOrder,
  startProductionOrder,
} from "../actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ProductionOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SP;
}) {
  const { id } = await params;
  const sp = await searchParams;

  await ensureStockLocationTables();

  const order = await prisma.productionOrder.findUnique({
    where: { id: Number(id) },
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
  });

  if (!order) notFound();

  return (
    <>
      <PageHeader
        title={`Ordem de Produção ${order.code}`}
        subtitle={`Destino: Máquina "${order.machine}" • Criada em ${fmtDateTime(order.createdAt)}`}
        actions={
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <StatusBadge status={order.status} />
            <Link className="btn secondary" href="/producao">
              <ArrowLeft size={15} /> Voltar
            </Link>
            <Link className="btn secondary" href={`/producao/${order.id}/recibo`}>
              <Printer size={15} /> Ficha da Máquina
            </Link>
          </div>
        }
      />

      <FlashMessages sp={sp} />

      {/* Painel de Ações de Fluxo da OP */}
      <div
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20,
          background: "var(--bg-subtle, #f4f4f5)",
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>
            Status da Produção: <StatusBadge status={order.status} />
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
            {order.status === "PLANEJADA" && "Os materiais devem ser separados no estoque e levados até a máquina para iniciar a operação."}
            {order.status === "EM_PRODUCAO" && `Produção em andamento na máquina "${order.machine}". Clique em concluir quando a fabricação for finalizada.`}
            {order.status === "CONCLUIDA" && `Produção concluída em ${fmtDateTime(order.completedAt)}. Matérias-primas baixadas e produtos fabricados adicionados ao estoque.`}
            {order.status === "CANCELADA" && "Esta ordem de produção foi cancelada."}
          </div>
        </div>

        <div className="row" style={{ gap: 8 }}>
          {order.status === "PLANEJADA" && (
            <ConfirmButton
              action={startProductionOrder.bind(null, order.id)}
              confirmText={`Confirmar início da produção na máquina "${order.machine}"?`}
              className="btn"
            >
              <Play size={15} /> Iniciar Produção na Máquina
            </ConfirmButton>
          )}

          {order.status === "EM_PRODUCAO" && (
            <ConfirmButton
              action={completeProductionOrder.bind(null, order.id)}
              confirmText={`Concluir OP #${order.code}? Isto dará baixa automática nas matérias-primas e adicionará ${order.quantity} un de "${order.product.name}" ao estoque.`}
              className="btn"
              style={{ background: "#16a34a", borderColor: "#16a34a", color: "#fff" }}
            >
              <CheckCircle2 size={16} /> Concluir Produção & Dar Baixa no Estoque
            </ConfirmButton>
          )}

          {order.status !== "CANCELADA" && (
            <ConfirmButton
              action={cancelProductionOrder.bind(null, order.id)}
              confirmText="Deseja realmente cancelar esta Ordem de Produção?"
              className="btn ghost text-danger"
            >
              <XCircle size={15} /> Cancelar OP
            </ConfirmButton>
          )}
        </div>
      </div>

      {/* Grid com Dados Principais da OP */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
        {/* Card da Máquina & Operador */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Factory size={18} />
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Máquina & Entrega</h3>
          </div>
          <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <span className="muted">Máquina / Posto de Trabalho:</span>
              <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{order.machine}</div>
            </div>
            <div>
              <span className="muted">Operador Responsável:</span>
              <div style={{ fontWeight: 600, marginTop: 2 }}>{order.operatorName || "Não informado"}</div>
            </div>
            <div>
              <span className="muted">Previsão de Entrega dos Materiais:</span>
              <div style={{ fontWeight: 500, marginTop: 2 }}>{order.deliveryDate ? fmtDate(order.deliveryDate) : "Sem prazo fixo"}</div>
            </div>
          </div>
        </div>

        {/* Card do Produto a Fabricar */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Package size={18} />
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Produto Final a Produzir</h3>
          </div>
          <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <span className="muted">Produto:</span>
              <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{order.product.name}</div>
              {order.product.sku && <div style={{ fontSize: 11, color: "var(--muted)" }}>SKU: {order.product.sku}</div>}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <span className="muted">Qtd Planejada:</span>
                <div style={{ fontWeight: 700, fontSize: 15, marginTop: 2 }}>
                  {num(order.quantity)} {order.product.unit}
                </div>
              </div>
              <div>
                <span className="muted">Estoque Atual:</span>
                <div style={{ fontWeight: 600, fontSize: 15, marginTop: 2 }}>
                  {num(order.product.stock)} {order.product.unit}
                </div>
              </div>
              <div>
                <span className="muted">Prioridade:</span>
                <div style={{ marginTop: 2 }}>
                  <StatusBadge status={order.priority} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card de Prazos e Instruções */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Clock size={18} />
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Histórico & Observações</h3>
          </div>
          <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
            <div>
              <span className="muted">Início:</span> {order.startDate ? fmtDateTime(order.startDate) : "Aguardando início"}
            </div>
            <div>
              <span className="muted">Conclusão:</span> {order.completedAt ? fmtDateTime(order.completedAt) : "Não concluída"}
            </div>
            <div>
              <span className="muted">Responsável no sistema:</span> {order.user?.name || "—"}
            </div>
            {order.notes && (
              <div style={{ marginTop: 6, padding: "8px 10px", background: "var(--bg-subtle, #f4f4f5)", borderRadius: 6 }}>
                <strong>Instruções:</strong> {order.notes}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lista de Insumos & Separação no Estoque (BOM) */}
      <div className="card table-responsive">
        <div style={{ padding: "4px 0 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
              Lista de Insumos & Separação para Entrega na Máquina (BOM)
            </h3>
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "3px 0 0" }}>
              Materiais que o almoxarifado deve separar e transportar até a máquina <strong>{order.machine}</strong>.
            </p>
          </div>
          <Link className="btn secondary" href={`/producao/${order.id}/recibo`}>
            <Printer size={14} /> Imprimir Ficha de Separação
          </Link>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>Check</th>
              <th>Matéria-Prima / Insumo</th>
              <th style={{ textAlign: "right" }}>Qtd Necessária</th>
              <th>Endereço para Retirada no Estoque</th>
              <th>Instrução do Insumo</th>
              <th>Disponibilidade no Estoque</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => {
              const isSufficient = item.product.stock >= item.quantityRequired;
              return (
                <tr key={item.id}>
                  <td>
                    <input type="checkbox" style={{ cursor: "pointer", width: 16, height: 16 }} />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.product.name}</div>
                    {item.product.sku && (
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>SKU: {item.product.sku}</div>
                    )}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>
                    {num(item.quantityRequired)} {item.product.unit}
                  </td>
                  <td>
                    {item.location ? (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span className="badge blue" style={{ fontWeight: 600 }}>
                          <MapPin size={11} style={{ marginRight: 3 }} />
                          {item.location.code}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>
                          {[item.location.aisle, item.location.rack, item.location.shelf, item.location.bin]
                            .filter(Boolean)
                            .join(" / ")}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>Área geral (sem endereço específico)</span>
                    )}
                  </td>
                  <td>
                    {item.notes ? (
                      <span style={{ fontSize: 12.5 }}>{item.notes}</span>
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td>
                    {isSufficient ? (
                      <span className="badge green" style={{ fontSize: 11 }}>
                        <CheckCircle2 size={11} style={{ marginRight: 3 }} /> Saldo: {item.product.stock} {item.product.unit}
                      </span>
                    ) : (
                      <span className="badge red" style={{ fontSize: 11 }} title="Estoque insuficiente">
                        <AlertTriangle size={11} style={{ marginRight: 3 }} /> Saldo: {item.product.stock} (Falta {num(item.quantityRequired - item.product.stock)})
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
