import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, MessageCircle, Printer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { brl, fmtDate, fmtDateTime, PAYMENT_METHODS, toInputDate, todayInput } from "@/lib/format";
import { buildWhatsAppUrl, osWhatsAppMessage } from "@/lib/whatsapp";
import { makePublicToken } from "@/lib/public-token";
import { FlashMessages, PageHeader, StatusBadge } from "@/components/ui";
import { ActionForm, ConfirmButton } from "@/components/Forms";
import { ItemsEditor } from "@/components/ItemsEditor";
import { PublicApprovalShare } from "@/components/PublicApprovalShare";
import { cancelServiceOrder, completeServiceOrder, deleteServiceOrder, saveServiceOrder } from "../actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ServiceOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SP;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "novo";
  const os = isNew
    ? null
    : await prisma.serviceOrder.findUnique({
        where: { id: Number(id) },
        include: { items: { include: { product: true } }, client: true, technician: true, user: true, financial: true },
      });
  if (!isNew && !os) notFound();

  const editable = isNew || (os!.status !== "CONCLUIDA" && os!.status !== "CANCELADA");

  const [clients, technicians, products] = await Promise.all([
    prisma.client.findMany({ where: { OR: [{ active: true }, { id: os?.clientId ?? -1 }] }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: { OR: [{ active: true }, { id: os?.technicianId ?? -1 }] }, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { OR: [{ active: true }, { id: { in: os?.items.map((i) => i.productId) ?? [] } }] },
      orderBy: { name: "asc" },
    }),
  ]);

  const editorProducts = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    unit: p.unit,
    price: p.salePrice,
    stock: p.stock,
  }));
  const initialItems = os?.items.map((i) => ({ productId: i.productId, quantity: i.quantity, price: i.unitPrice })) ?? [];
  const defaultClientId = typeof sp.clientId === "string" ? Number(sp.clientId) : os?.clientId ?? "";

  const waUrl = os
    ? buildWhatsAppUrl(
        os.client?.phone,
        osWhatsAppMessage({
          id: os.id,
          equipment: os.equipment,
          status: os.status,
          total: os.total,
          diagnosis: os.diagnosis,
          clientName: os.client?.name,
        }),
      )
    : null;

  return (
    <>
      <PageHeader
        title={isNew ? "Nova Ordem de Serviço" : `Ordem de Serviço #${os!.id}`}
        subtitle={
          isNew
            ? "Registre o equipamento, defeito relatado, diagnóstico, mão de obra e peças"
            : `Aberta em ${fmtDateTime(os!.createdAt)} por ${os!.user?.name ?? "—"}`
        }
        actions={
          os && (
            <>
              <StatusBadge status={os.priority} />
              <StatusBadge status={os.status} />
              <PublicApprovalShare
                relativePath={`/p/os/${os.id}?t=${makePublicToken("os", os.id)}`}
                clientPhone={os.client?.phone}
                whatsappMessagePrefix={`Olá${os.client?.name ? ` ${os.client.name}` : ""}! Acompanhe e autorize online a sua Ordem de Serviço #${os.id} (${os.equipment}) no valor de ${brl(os.total)}.`}
                label="Link de Aprovação OS"
              />
              {waUrl && (
                <a className="btn secondary" href={waUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={15} /> WhatsApp
                </a>
              )}
              <Link className="btn secondary" href={`/os/${os.id}/recibo`}>
                <Printer size={15} /> Imprimir OS
              </Link>
              {editable && (
                <ConfirmButton
                  action={completeServiceOrder.bind(null, os.id)}
                  label="Concluir OS"
                  className="btn success"
                  confirmText="Concluir esta OS? As peças serão baixadas do estoque e o valor total será lançado no financeiro."
                />
              )}
              {os.status !== "CANCELADA" && (
                <ConfirmButton
                  action={cancelServiceOrder.bind(null, os.id)}
                  label="Cancelar OS"
                  className="btn warning"
                  confirmText="Cancelar esta OS? Se concluída, o estoque das peças será devolvido."
                />
              )}
              {os.status !== "CONCLUIDA" && (
                <ConfirmButton
                  action={deleteServiceOrder.bind(null, os.id)}
                  label="Excluir"
                  className="btn danger"
                  confirmText="Excluir definitivamente esta OS?"
                />
              )}
            </>
          )
        }
      />
      <FlashMessages sp={sp} />

      {editable ? (
        <div className="card">
          <ActionForm
            action={saveServiceOrder.bind(null, os?.id ?? null)}
            submitLabel={isNew ? "Abrir Ordem de Serviço" : "Salvar alterações"}
            extraActions={
              <Link className="btn secondary" href="/os">
                Voltar
              </Link>
            }
          >
            <div className="form-grid mb">
              <div className="field s4">
                <label>Cliente</label>
                <select name="clientId" defaultValue={defaultClientId}>
                  <option value="">Cliente avulso</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field s4">
                <label>Técnico responsável</label>
                <select name="technicianId" defaultValue={os?.technicianId ?? ""}>
                  <option value="">Não atribuído</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.position})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field s2">
                <label>Prioridade</label>
                <select name="priority" defaultValue={os?.priority ?? "NORMAL"}>
                  <option value="BAIXA">Baixa</option>
                  <option value="NORMAL">Normal</option>
                  <option value="ALTA">Alta</option>
                  <option value="URGENTE">Urgente</option>
                </select>
              </div>
              <div className="field s2">
                <label>Andamento</label>
                <select name="status" defaultValue={os?.status ?? "ABERTA"}>
                  <option value="ABERTA">Aberta</option>
                  <option value="EM_ANDAMENTO">Em andamento</option>
                  <option value="AGUARDANDO_PECA">Aguardando peça</option>
                </select>
              </div>

              <div className="field s8">
                <label>Equipamento / Item atendido *</label>
                <input name="equipment" placeholder="Ex.: Notebook Dell Latitude 5420" defaultValue={os?.equipment ?? ""} required />
              </div>
              <div className="field s4">
                <label>Nº de Série / Patrimônio / Placa</label>
                <input name="serialNumber" defaultValue={os?.serialNumber ?? ""} />
              </div>

              <div className="field s4">
                <label>Data de abertura</label>
                <input type="date" name="openedAt" defaultValue={os ? toInputDate(os.openedAt) : todayInput()} required />
              </div>
              <div className="field s4">
                <label>Previsão de entrega</label>
                <input type="date" name="expectedDate" defaultValue={os ? toInputDate(os.expectedDate) : ""} />
              </div>
              <div className="field s4">
                <label>Forma de pagamento</label>
                <select name="paymentMethod" defaultValue={os?.paymentMethod ?? ""}>
                  <option value="">—</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Defeito / Solicitação relatada pelo cliente *</label>
                <textarea name="reportedIssue" defaultValue={os?.reportedIssue ?? ""} required />
              </div>
              <div className="field">
                <label>Diagnóstico técnico / Serviço executado</label>
                <textarea name="diagnosis" defaultValue={os?.diagnosis ?? ""} />
              </div>
            </div>

            <h2 className="mb">Peças, Produtos e Mão de Obra</h2>
            <ItemsEditor
              products={editorProducts}
              initialItems={initialItems}
              initialDiscount={os?.discount ?? 0}
              initialLaborCost={os?.laborCost ?? 0}
              showDiscount
              showLaborCost
              checkStock
              allowEmpty
            />

            <div className="field s12 mt">
              <label>Observações internas / Condições de garantia</label>
              <textarea name="notes" defaultValue={os?.notes ?? ""} />
            </div>
          </ActionForm>
        </div>
      ) : (
        <div className="card">
          <dl className="dl mb">
            <dt>Cliente</dt>
            <dd>{os!.client ? <Link href={`/clientes/${os!.clientId}`}>{os!.client.name}</Link> : "Cliente avulso"}</dd>
            <dt>Técnico responsável</dt>
            <dd>{os!.technician?.name ?? "—"}</dd>
            <dt>Equipamento</dt>
            <dd>
              {os!.equipment} {os!.serialNumber && <span className="muted">(S/N: {os!.serialNumber})</span>}
            </dd>
            <dt>Abertura / Conclusão</dt>
            <dd>
              {fmtDate(os!.openedAt)} — {os!.completedAt ? fmtDateTime(os!.completedAt) : "—"}
            </dd>
            <dt>Defeito relatado</dt>
            <dd>{os!.reportedIssue}</dd>
            <dt>Laudo / Diagnóstico</dt>
            <dd>{os!.diagnosis ?? "—"}</dd>
            <dt>Forma de pagamento</dt>
            <dd>{os!.paymentMethod ?? "—"}</dd>
          </dl>

          <ItemsEditor
            products={editorProducts}
            initialItems={initialItems}
            initialDiscount={os!.discount}
            initialLaborCost={os!.laborCost}
            showDiscount
            showLaborCost
            allowEmpty
            readOnly
          />
        </div>
      )}

      {os && os.financial.length > 0 && (
        <div className="card flush">
          <div className="card-header">
            <h2>
              <CheckCircle2 size={16} /> Lançamentos financeiros vinculados
            </h2>
          </div>
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th className="num">Valor</th>
              </tr>
            </thead>
            <tbody>
              {os.financial.map((f) => (
                <tr key={f.id}>
                  <td>
                    <Link href={`/financeiro/${f.id}`}>{f.description}</Link>
                  </td>
                  <td>{fmtDate(f.dueDate)}</td>
                  <td>
                    <StatusBadge status={f.status} />
                  </td>
                  <td className="num">{brl(f.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
