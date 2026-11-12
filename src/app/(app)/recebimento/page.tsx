import Link from "next/link";
import type { Prisma } from "@prisma/client";
import {
  ArrowDownLeft,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  MapPin,
  Package,
  PackageCheck,
  Plus,
  Printer,
  Receipt,
  Search,
  Truck,
  XCircle,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { pageParams, spStr } from "@/lib/form";
import { brl, fmtDateTime } from "@/lib/format";
import { ExportCsvButton, FlashMessages, PageHeader, Pagination, StatusBadge } from "@/components/ui";
import { ConfirmButton } from "@/components/Forms";
import { XmlImportModal } from "@/components/XmlImportModal";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { cancelGoodsReceipt } from "./actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function RecebimentoPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = spStr(sp, "q");
  const status = spStr(sp, "status");
  const { page, skip, take, pageSize } = pageParams(sp);

  await ensureStockLocationTables();

  const where: Prisma.GoodsReceiptWhereInput = {
    ...(q && {
      OR: [
        { code: { contains: q } },
        { invoiceNumber: { contains: q } },
        { supplier: { name: { contains: q } } },
        { notes: { contains: q } },
      ],
    }),
    ...(status && { status }),
  };

  const [receipts, total, pendingPurchases, totalReceivedThisMonth] = await Promise.all([
    prisma.goodsReceipt.findMany({
      where,
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      skip,
      take,
      include: {
        supplier: true,
        user: true,
        items: {
          include: {
            product: true,
            location: true,
          },
        },
      },
    }),
    prisma.goodsReceipt.count({ where }),
    prisma.purchase.findMany({
      where: { status: "PENDENTE" },
      orderBy: { date: "desc" },
      take: 5,
      include: { supplier: true, _count: { select: { items: true } } },
    }),
    prisma.goodsReceipt.count({
      where: {
        status: "RECEBIDO",
        receivedAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Recebimento de Mercadorias & Matérias-Primas"
        subtitle="Entrada de insumos, conferência de notas fiscais e endereçamento direto no estoque"
        actions={
          <>
            <XmlImportModal />
            <ExportCsvButton entity="recebimento" />
            <Link className="btn" href="/recebimento/novo">
              <Plus size={16} /> Novo Recebimento
            </Link>
          </>
        }
      />

      <FlashMessages sp={sp} />

      {/* Estatísticas Rápidas */}
      <div className="stats">
        <div className="stat primary">
          <div className="label">Recebimentos no Mês</div>
          <div className="value">{totalReceivedThisMonth}</div>
          <div className="hint">Cargas e notas fiscais conferidas</div>
        </div>
        <div className="stat warning">
          <div className="label">Compras Aguardando Entrega</div>
          <div className="value">{pendingPurchases.length}</div>
          <div className="hint">Pedidos com status Pendente</div>
        </div>
        <div className="stat">
          <div className="label">Total de Registros</div>
          <div className="value">{total}</div>
          <div className="hint">Histórico completo de entradas</div>
        </div>
      </div>

      {/* Alerta de Pedidos de Compras Pendentes para Recebimento Rápido */}
      {pendingPurchases.length > 0 && (
        <div className="card" style={{ marginBottom: 20, borderColor: "var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 14 }}>
              <Receipt size={17} />
              <span>Pedidos de Compra prontos para receber</span>
            </div>
            <Link href="/compras" style={{ fontSize: 13, color: "var(--muted)" }}>
              Ver todas as compras →
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {pendingPurchases.map((p) => (
              <div
                key={p.id}
                style={{
                  background: "var(--bg-subtle, #f4f4f5)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "10px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>Compra #{p.id}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {p.supplier?.name || "Fornecedor avulso"} • {p._count.items} item(ns)
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, marginTop: 2 }}>{brl(p.total)}</div>
                </div>
                <Link className="btn" style={{ fontSize: 12, padding: "5px 10px" }} href={`/recebimento/novo?purchaseId=${p.id}`}>
                  <PackageCheck size={14} /> Receber Carga
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros e Busca */}
      <form className="filters" method="get">
        <div className="input-icon" style={{ flex: 1 }}>
          <Search size={16} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por código REC, nota fiscal, fornecedor ou observação..."
          />
        </div>
        <select name="status" defaultValue={status}>
          <option value="">Todos os status</option>
          <option value="RECEBIDO">Recebido</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
        <button type="submit" className="btn secondary">
          Filtrar
        </button>
        {(q || status) && (
          <Link href="/recebimento" className="btn ghost">
            Limpar
          </Link>
        )}
      </form>

      {/* Tabela de Recebimentos */}
      <div className="card table-responsive">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Data/Hora</th>
              <th>NF-e</th>
              <th>Fornecedor</th>
              <th>Itens / Matérias-Primas</th>
              <th>Endereço Estoque</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "36px 0", color: "var(--muted)" }}>
                  <PackageCheck size={36} style={{ margin: "0 auto 8px", opacity: 0.35, display: "block" }} />
                  Nenhum recebimento registrado até o momento.
                </td>
              </tr>
            ) : (
              receipts.map((r) => {
                const totalQty = r.items.reduce((s, i) => s + i.quantity, 0);
                const hasLocations = r.items.some((i) => i.location);

                return (
                  <tr key={r.id}>
                    <td>
                      <span style={{ fontWeight: 600, fontFamily: "monospace" }}>{r.code}</span>
                      {r.purchaseId && (
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>Origem: Compra #{r.purchaseId}</div>
                      )}
                    </td>
                    <td>{fmtDateTime(r.receivedAt)}</td>
                    <td>
                      {r.invoiceNumber ? (
                        <span style={{ fontWeight: 500 }}>NF {r.invoiceNumber}</span>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>Sem NF</span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{r.supplier?.name || "Entrada Direta / Sem Fornecedor"}</div>
                      {r.user && <div style={{ fontSize: 11, color: "var(--muted)" }}>Recebido por {r.user.name}</div>}
                    </td>
                    <td>
                      <span className="badge gray" style={{ fontWeight: 600 }}>
                        {r.items.length} produto(s) • {totalQty} un
                      </span>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.items.map((i) => `${i.quantity}x ${i.product.name}`).join(", ")}
                      </div>
                    </td>
                    <td>
                      {hasLocations ? (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {r.items
                            .filter((i) => i.location)
                            .map((i) => (
                              <span key={i.id} className="badge blue" style={{ fontSize: 11 }} title={`${i.product.name}: ${i.location?.description || ""}`}>
                                <MapPin size={10} style={{ marginRight: 2 }} />
                                {i.location?.code}
                              </span>
                            ))}
                        </div>
                      ) : (
                        <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="row justify-end" style={{ gap: 6 }}>
                        <Link
                          className="btn secondary"
                          style={{ padding: "4px 8px", fontSize: 12 }}
                          href={`/recebimento/${r.id}/recibo`}
                          title="Imprimir Comprovante de Recebimento"
                        >
                          <Printer size={13} /> Recibo
                        </Link>
                        {r.status === "RECEBIDO" && (
                          <ConfirmButton
                            action={cancelGoodsReceipt.bind(null, r.id)}
                            confirmText="Tem certeza que deseja cancelar este recebimento? O estoque e os endereçamentos vinculados serão estornados."
                            className="btn ghost text-danger"
                            style={{ padding: "4px 8px", fontSize: 12 }}
                            title="Cancelar recebimento"
                          >
                            <XCircle size={13} />
                          </ConfirmButton>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination basePath="/recebimento" sp={sp} page={page} pageSize={pageSize} total={total} />
    </>
  );
}
