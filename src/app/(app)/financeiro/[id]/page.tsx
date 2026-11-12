import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { spStr } from "@/lib/form";
import { toInputDate, todayInput } from "@/lib/format";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/Forms";
import { saveEntry } from "../actions";

const CATEGORIES = {
  RECEITA: ["Vendas", "Serviços", "Juros", "Outras receitas"],
  DESPESA: ["Compras", "Aluguel", "Salários", "Impostos", "Energia", "Água", "Internet/Telefone", "Marketing", "Manutenção", "Outras despesas"],
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function LancamentoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  await requireAdmin();
  await ensureStockLocationTables();
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "novo";
  const entry = isNew ? null : await prisma.financialEntry.findUnique({ where: { id: Number(id) } });
  if (!isNew && !entry) notFound();

  const type = entry?.type ?? (spStr(sp, "type") === "DESPESA" ? "DESPESA" : "RECEITA");
  const [used, bankAccounts] = await Promise.all([
    prisma.financialEntry.findMany({ where: { category: { not: null } }, distinct: ["category"], select: { category: true } }),
    prisma.bankAccount.findMany({ where: { active: true }, orderBy: { id: "asc" } }),
  ]);
  const categories = [...new Set([...CATEGORIES.RECEITA, ...CATEGORIES.DESPESA, ...used.map((u) => u.category!)])];

  return (
    <>
      <PageHeader
        title={isNew ? (type === "RECEITA" ? "Nova receita" : "Nova despesa") : "Editar lançamento"}
        subtitle={entry?.saleId ? `Vinculado à venda #${entry.saleId}` : entry?.purchaseId ? `Vinculado à compra #${entry.purchaseId}` : undefined}
      />
      <div className="card">
        <ActionForm
          action={saveEntry.bind(null, entry?.id ?? null)}
          extraActions={
            <Link className="btn secondary" href="/financeiro">
              Cancelar
            </Link>
          }
        >
          <div className="form-grid">
            <div className="field s3">
              <label>Tipo *</label>
              <select name="type" defaultValue={type}>
                <option value="RECEITA">Receita (a receber)</option>
                <option value="DESPESA">Despesa (a pagar)</option>
              </select>
            </div>
            <div className="field s9" style={{ gridColumn: "span 9" }}>
              <label>Descrição *</label>
              <input name="description" defaultValue={entry?.description ?? ""} required />
            </div>
            <div className="field s4">
              <label>Categoria</label>
              <input name="category" list="fin-categories" defaultValue={entry?.category ?? ""} />
              <datalist id="fin-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="field s4">
              <label>Valor (R$) *</label>
              <input name="amount" type="number" step="0.01" min="0.01" defaultValue={entry?.amount ?? ""} required />
            </div>
            <div className="field s4">
              <label>Vencimento *</label>
              <input name="dueDate" type="date" defaultValue={entry ? toInputDate(entry.dueDate) : todayInput()} required />
            </div>
            <div className="field s4">
              <label>Status</label>
              <select name="status" defaultValue={entry?.status ?? "PENDENTE"}>
                <option value="PENDENTE">Pendente</option>
                <option value="PAGO">Pago / Recebido</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>
            <div className="field s4">
              <label>Data do pagamento</label>
              <input name="paidAt" type="date" defaultValue={entry?.paidAt ? toInputDate(entry.paidAt) : ""} />
            </div>
            <div className="field s4">
              <label>Conta / Carteira Bancária</label>
              <select name="bankAccountId" defaultValue={entry?.bankAccountId ?? ""}>
                <option value="">Sem conta específica</option>
                {bankAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} {acc.bankName ? `(${acc.bankName})` : ""}
                  </option>
                ))}
              </select>
            </div>
            {isNew && (
              <>
                <div className="field s6">
                  <label>Repetir / Parcelar (nº de parcelas ou meses)</label>
                  <input name="repeat" type="number" min="1" max="60" defaultValue={1} />
                </div>
                <div className="field s6">
                  <label>Periodicidade da Recorrência / Parcelamento</label>
                  <select name="frequency" defaultValue="MENSAL">
                    <option value="MENSAL">Mensal (a cada 30 dias / mês)</option>
                    <option value="QUINZENAL">Quinzenal (a cada 15 dias)</option>
                    <option value="SEMANAL">Semanal (a cada 7 dias)</option>
                    <option value="ANUAL">Anual (1x por ano)</option>
                  </select>
                </div>
              </>
            )}
            <div className="field s12">
              <label>Observações</label>
              <textarea name="notes" defaultValue={entry?.notes ?? ""} />
            </div>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
