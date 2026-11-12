import Link from "next/link";
import { Building2, Calendar, CheckCircle2, FileText, PauseCircle, PlayCircle, Plus, RefreshCw, Sparkles, Wrench } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { spStr } from "@/lib/form";
import { brl, fmtDate, todayInput } from "@/lib/format";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { FlashMessages, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/Forms";
import { billContractNowAction, createContractAction, updateContractStatusAction } from "./actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ContratosPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  await ensureStockLocationTables();

  const sp = await searchParams;
  const statusFilter = spStr(sp, "status");
  const q = spStr(sp, "q");

  const [contracts, clients] = await Promise.all([
    prisma.contract.findMany({
      where: {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { client: { name: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: { client: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true },
    }),
  ]);

  const activeContracts = contracts.filter((c) => c.status === "ATIVO");
  const mrr = activeContracts.reduce((s, c) => {
    if (c.recurrence === "TRIMESTRAL") return s + c.amount / 3;
    if (c.recurrence === "SEMESTRAL") return s + c.amount / 6;
    if (c.recurrence === "ANUAL") return s + c.amount / 12;
    return s + c.amount;
  }, 0);

  return (
    <>
      <PageHeader
        title="Contratos & Mensalidades Recorrentes"
        subtitle="Gerenciamento de contratos de serviços, manutenções periódicas e faturamento automático de mensalidades (MRR)"
      />
      <FlashMessages sp={sp} />

      {/* Estatísticas MRR */}
      <div className="stats">
        <div className="stat primary">
          <div className="label">Receita Recorrente Mensal (MRR)</div>
          <div className="value">{brl(mrr)}</div>
          <div className="hint">{activeContracts.length} contrato(s) ativo(s)</div>
        </div>
        <div className="stat">
          <div className="label">Total de Contratos Gerenciados</div>
          <div className="value">{contracts.length}</div>
          <div className="hint">{contracts.filter((c) => c.status === "PAUSADO").length} pausado(s)</div>
        </div>
        <div className="stat">
          <div className="label">Ticket Médio Mensal</div>
          <div className="value">
            {brl(activeContracts.length > 0 ? mrr / activeContracts.length : 0)}
          </div>
          <div className="hint">por cliente sob contrato</div>
        </div>
      </div>

      {/* Formulário de Novo Contrato */}
      <div className="card mb">
        <h2 className="mb" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Plus size={18} /> Novo Contrato Recorrente
        </h2>
        <form action={createContractAction}>
          <div className="form-grid">
            <div className="field s4">
              <label>Cliente *</label>
              <select name="clientId" required>
                <option value="">Selecione o cliente...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field s4">
              <label>Título / Objeto do Contrato *</label>
              <input name="title" placeholder="Ex: Suporte TI / Manutenção Preventiva Mensal" required />
            </div>
            <div className="field s2">
              <label>Valor (R$) *</label>
              <input type="number" step="0.01" min="0.01" name="amount" placeholder="Ex: 850,00" required />
            </div>
            <div className="field s2">
              <label>Recorrência *</label>
              <select name="recurrence" defaultValue="MENSAL">
                <option value="MENSAL">Mensal</option>
                <option value="TRIMESTRAL">Trimestral</option>
                <option value="SEMESTRAL">Semestral</option>
                <option value="ANUAL">Anual</option>
              </select>
            </div>
            <div className="field s2">
              <label>Dia Vencimento (1 a 31) *</label>
              <input type="number" name="dueDay" min="1" max="31" defaultValue="10" required />
            </div>
            <div className="field s3">
              <label>Início da Vigência *</label>
              <input type="date" name="startDate" defaultValue={todayInput()} required />
            </div>
            <div className="field s7" style={{ display: "flex", alignItems: "center", gap: 20, paddingTop: 24 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: 0, cursor: "pointer" }}>
                <input type="checkbox" name="autoGenerateFinEntry" defaultChecked />
                Gerar Conta a Receber no Financeiro
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: 0, cursor: "pointer" }}>
                <input type="checkbox" name="autoGenerateOS" />
                Gerar OS Preventiva Automática
              </label>
            </div>
            <div className="field s12">
              <label>Descrição Opcional / Escopo do Serviço</label>
              <input name="osServiceDescription" placeholder="Instruções para o técnico ou observações que sairão na OS periódica" />
            </div>
          </div>
          <div className="row end mt">
            <button type="submit" className="btn">
              <Plus size={14} /> Cadastrar Contrato
            </button>
          </div>
        </form>
      </div>

      {/* Lista de Contratos */}
      <div className="card flush">
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <FileText size={18} /> Contratos Cadastrados ({contracts.length})
          </h2>

          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href="/contratos"
              className={`btn sm ${!statusFilter ? "primary" : "secondary"}`}
            >
              Todos
            </Link>
            <Link
              href="/contratos?status=ATIVO"
              className={`btn sm ${statusFilter === "ATIVO" ? "primary" : "secondary"}`}
            >
              Ativos
            </Link>
            <Link
              href="/contratos?status=PAUSADO"
              className={`btn sm ${statusFilter === "PAUSADO" ? "primary" : "secondary"}`}
            >
              Pausados
            </Link>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Contrato / Cliente</th>
                <th>Recorrência</th>
                <th>Dia Vcto</th>
                <th className="num">Valor</th>
                <th>Automações</th>
                <th>Status</th>
                <th className="actions">Ações</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="bold">{c.title}</div>
                    <div className="small muted">
                      <Link href={`/clientes/${c.clientId}`}>{c.client.name}</Link>
                    </div>
                  </td>
                  <td>
                    <span className="badge gray">{c.recurrence}</span>
                  </td>
                  <td>Dia {c.dueDay}</td>
                  <td className="num bold" style={{ fontSize: 14 }}>
                    {brl(c.amount)}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {c.autoGenerateFinEntry && (
                        <span className="badge green" title="Gera receita no Financeiro todo mês">
                          Financeiro
                        </span>
                      )}
                      {c.autoGenerateOS && (
                        <span className="badge blue" title="Gera Ordem de Serviço preventiva todo mês">
                          <Wrench size={10} /> OS Preventiva
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${c.status === "ATIVO" ? "green" : c.status === "PAUSADO" ? "yellow" : "gray"}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="actions">
                    <ConfirmButton
                      action={billContractNowAction.bind(null, c.id)}
                      className="btn sm"
                      confirmText={`Faturar imediatamente a mensalidade de ${brl(c.amount)} para ${c.client.name}? O lançamento a receber será criado no Financeiro.`}
                    >
                      <Sparkles size={12} /> Faturar Agora
                    </ConfirmButton>

                    {c.status === "ATIVO" ? (
                      <ConfirmButton
                        action={updateContractStatusAction.bind(null, c.id, "PAUSADO")}
                        className="btn sm secondary"
                        confirmText={`Pausar contrato de ${c.client.name}? O sistema suspenderá as cobranças automáticas.`}
                      >
                        <PauseCircle size={12} /> Pausar
                      </ConfirmButton>
                    ) : (
                      <ConfirmButton
                        action={updateContractStatusAction.bind(null, c.id, "ATIVO")}
                        className="btn sm secondary"
                        confirmText={`Reativar contrato de ${c.client.name}?`}
                      >
                        <PlayCircle size={12} /> Reativar
                      </ConfirmButton>
                    )}
                  </td>
                </tr>
              ))}

              {contracts.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    Nenhum contrato cadastrado. Preencha o formulário acima para criar o primeiro contrato de prestação recorrente.
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
