import Link from "next/link";
import {
  CheckCircle2,
  FileSpreadsheet,
  Plus,
  Printer,
  RefreshCw,
  Wallet,
  Zap,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { spStr } from "@/lib/form";
import { brl, fmtDate, todayInput } from "@/lib/format";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { calculateCompletePayslip } from "@/lib/rh-calc";
import { FlashMessages, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/Forms";
import { RhSubnav } from "../RhSubnav";
import {
  addPayrollEventAction,
  autoProcessCompletePayrollAction,
  deletePayrollEventAction,
  payAllPayrollEntriesAction,
  quickAdvanceSalary40PctAction,
} from "../actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function FolhaPagamentoPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin("funcionarios");
  await ensureStockLocationTables();

  const sp = await searchParams;
  const refMonth = spStr(sp, "month") || todayInput().slice(0, 7);
  const [y, m] = refMonth.split("-").map(Number);
  const label = `${String(m).padStart(2, "0")}/${y}`;

  const [employees, monthEvents, payrollFinancialEntries] = await Promise.all([
    prisma.employee.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: {
        payrollEvents: { where: { month: refMonth }, orderBy: { id: "asc" } },
      },
    }),
    prisma.employeePayrollEvent.findMany({
      where: { month: refMonth },
      include: { employee: true },
      orderBy: { id: "desc" },
    }),
    prisma.financialEntry.findMany({
      where: { description: { contains: `ref. ${label}` } },
      orderBy: { id: "asc" },
    }),
  ]);

  let totalBase = 0;
  let totalAdditions = 0;
  let totalDeductions = 0;
  let totalNet = 0;
  let totalFgts = 0;
  let totalInssIrrf = 0;

  const rows = employees.map((emp) => {
    const calc = calculateCompletePayslip(emp, emp.payrollEvents);
    const extras = calc.totalAdditions - calc.baseSalary;
    const vales = emp.payrollEvents
      .filter((ev) => ev.category === "ADIANTAMENTO_VALE")
      .reduce((s, ev) => s + ev.amount, 0);
    const finEntry = payrollFinancialEntries.find(
      (f) => f.category === "Salários" && f.description.includes(emp.name)
    );

    totalBase += calc.baseSalary;
    totalAdditions += calc.totalAdditions;
    totalDeductions += calc.totalDeductions;
    totalNet += calc.netSalary;
    totalFgts += calc.fgtsAmount;
    totalInssIrrf += calc.inssAmount + calc.irrfAmount;

    return {
      emp,
      calc,
      extras,
      vales,
      finEntry,
    };
  });

  const pendingEntriesCount = payrollFinancialEntries.filter((f) => f.status === "PENDENTE").length;
  const isAllPaid = payrollFinancialEntries.length > 0 && pendingEntriesCount === 0;

  return (
    <>
      <PageHeader
        title={`Folha de Pagamento — Competência ${label}`}
        subtitle="Fechamento automatizado integrado ao Relógio de Ponto (REP), cálculo de INSS/IRRF/FGTS, Vale Quinzenal e emissão de Holerites"
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <form action={autoProcessCompletePayrollAction}>
              <input type="hidden" name="month" value={refMonth} />
              <button type="submit" className="btn">
                <RefreshCw size={15} /> Sincronizar Ponto REP & Atualizar Folha ({label})
              </button>
            </form>
            {pendingEntriesCount > 0 && (
              <form action={payAllPayrollEntriesAction}>
                <input type="hidden" name="month" value={refMonth} />
                <button type="submit" className="btn secondary">
                  <CheckCircle2 size={15} /> Quitar Toda a Folha ({pendingEntriesCount} títulos)
                </button>
              </form>
            )}
          </div>
        }
      />
      <FlashMessages sp={sp} />

      <RhSubnav active="folha" refMonth={refMonth} basePath="/funcionarios/folha" />

      {/* Resumo Consolidado da Folha */}
      <div className="stats">
        <div className="stat">
          <div className="label">Total Proventos (Bruto + Extras)</div>
          <div className="value">{brl(totalAdditions)}</div>
          <div className="hint">Salários Base: {brl(totalBase)}</div>
        </div>
        <div className="stat">
          <div className="label">Total Descontos (INSS/IRRF/VT/Vales)</div>
          <div className="value">-{brl(totalDeductions)}</div>
          <div className="hint">INSS + IRRF Retido: {brl(totalInssIrrf)}</div>
        </div>
        <div className="stat primary">
          <div className="label">Salário Líquido Total a Pagar ({label})</div>
          <div className="value">{brl(totalNet)}</div>
          <div className="hint">
            {isAllPaid
              ? "✅ Folha 100% Paga no Financeiro"
              : payrollFinancialEntries.length > 0
                ? "📋 Gerada no Financeiro (Aguardando Baixa)"
                : "⏳ Aguardando Fechamento"}
          </div>
        </div>
        <div className="stat warn">
          <div className="label">Guia FGTS Digital (8%)</div>
          <div className="value">{brl(totalFgts)}</div>
          <div className="hint">vencimento dia 20/{String((m % 12) + 1).padStart(2, "0")}</div>
        </div>
      </div>

      {/* Tabela Principal: Espelho Geral da Folha de Pagamento */}
      <div className="card flush mb">
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Espelho Consolidado da Folha de Pagamento — {label}</h2>
            <div className="small muted">
              Cálculo automático de Salário Base + Horas Extras do Relógio REP + Insalubridade - INSS Progressivo - IRRF - VT 6% - Vale Quinzenal.
            </div>
          </div>
          <span className={`badge ${isAllPaid ? "green" : payrollFinancialEntries.length > 0 ? "blue" : "yellow"}`}>
            {isAllPaid
              ? `Folha ${label} Quitada (PAGA)`
              : payrollFinancialEntries.length > 0
                ? `Folha ${label} Lançada no Financeiro`
                : `Folha ${label} em Aberto`}
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Colaborador / Cargo</th>
                <th className="num">Salário Base</th>
                <th className="num">+ Extras REP / Adic.</th>
                <th className="num">- Vale 40%</th>
                <th className="num">- INSS / IRRF / VT</th>
                <th className="num">= Líquido a Receber</th>
                <th className="num">FGTS (8%)</th>
                <th>Status Financeiro</th>
                <th>Ações Rápidas</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ emp, calc, extras, vales, finEntry }) => (
                <tr key={emp.id}>
                  <td>
                    <div className="bold">
                      <Link href={`/funcionarios/${emp.id}`}>{emp.name}</Link>
                    </div>
                    <div className="small muted">
                      {emp.position} · <span className="badge blue">{emp.contractType || "CLT"}</span>
                    </div>
                  </td>
                  <td className="num">{brl(calc.baseSalary)}</td>
                  <td className="num bold">
                    {extras > 0 ? `+${brl(extras)}` : "—"}
                  </td>
                  <td className="num">
                    {vales > 0 ? (
                      <span className="badge yellow">-{brl(vales)}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="num small muted">
                    -{brl(calc.totalDeductions - vales)}
                    <div className="small">
                      INSS: {brl(calc.inssAmount)} · IRRF: {brl(calc.irrfAmount)}
                    </div>
                  </td>
                  <td className="num bold" style={{ fontSize: 15 }}>
                    {brl(calc.netSalary)}
                  </td>
                  <td className="num small">{brl(calc.fgtsAmount)}</td>
                  <td>
                    {finEntry ? (
                      <span className={`badge ${finEntry.status === "PAGO" ? "green" : "blue"}`}>
                        {finEntry.status === "PAGO" ? "PAGO" : "GERADO (PENDENTE)"}
                      </span>
                    ) : (
                      <span className="badge gray">Não gerado</span>
                    )}
                  </td>
                  <td className="actions">
                    {vales === 0 && (
                      <ConfirmButton
                        action={quickAdvanceSalary40PctAction.bind(null, emp.id, refMonth)}
                        label="⚡ Vale 40%"
                        className="btn sm secondary"
                        confirmText={`Emitir Adiantamento Salarial (Vale Quinzenal de 40% = ${brl(emp.salary * 0.4)}) para ${emp.name}? O valor será lançado como despesa no Financeiro e descontado automaticamente neste Holerite.`}
                      />
                    )}
                    <Link
                      className="btn sm"
                      href={`/funcionarios/${emp.id}/recibo?mes=${refMonth}`}
                    >
                      <Printer size={13} /> Holerite Oficial
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="bold">TOTAIS DA FOLHA ({rows.length} colaboradores)</td>
                <td className="num bold">{brl(totalBase)}</td>
                <td className="num bold">+{brl(totalAdditions - totalBase)}</td>
                <td className="num bold">
                  -{brl(rows.reduce((s, r) => s + r.vales, 0))}
                </td>
                <td className="num bold">
                  -{brl(totalDeductions - rows.reduce((s, r) => s + r.vales, 0))}
                </td>
                <td className="num bold" style={{ fontSize: 15 }}>
                  {brl(totalNet)}
                </td>
                <td className="num bold">{brl(totalFgts)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Títulos e Guias desta Folha já Criados no Financeiro */}
      <div className="card flush mb">
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <strong style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Wallet size={17} /> Lançamentos Financeiros e Guias de Impostos desta Folha ({label})
          </strong>
          <Link href="/financeiro" className="btn sm secondary">
            Abrir Módulo Financeiro →
          </Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Descrição do Título / Guia</th>
                <th>Categoria</th>
                <th>Vencimento</th>
                <th>Detalhamento / Memória de Cálculo</th>
                <th className="num">Valor Líquido</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payrollFinancialEntries.map((fin) => (
                <tr key={fin.id}>
                  <td className="bold">{fin.description}</td>
                  <td>
                    <span className={`badge ${fin.category === "Impostos" ? "yellow" : "blue"}`}>
                      {fin.category}
                    </span>
                  </td>
                  <td>{fmtDate(fin.dueDate)}</td>
                  <td className="small muted">{fin.notes || "Guia unificada gerada pelo fechamento da folha"}</td>
                  <td className="num bold">{brl(fin.amount)}</td>
                  <td>
                    <span className={`badge ${fin.status === "PAGO" ? "green" : "yellow"}`}>
                      {fin.status}
                    </span>
                  </td>
                </tr>
              ))}
              {payrollFinancialEntries.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    Clique em <strong>&quot;Sincronizar Ponto REP & Atualizar Folha&quot;</strong> no topo para gerar os títulos desta competência.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rubricas Variáveis Detalhadas + Adição Manual Opcional */}
      <div className="grid grid-2">
        <div className="card flush">
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
            <strong>Rubricas Variáveis Ativas nos Holerites de {label} ({monthEvents.length})</strong>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Rubrica</th>
                  <th>Origem</th>
                  <th className="num">Valor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {monthEvents.map((ev) => (
                  <tr key={ev.id}>
                    <td className="bold">{ev.employee.name}</td>
                    <td>
                      <span className={`badge ${ev.type === "PROVENTO" ? "green" : "red"}`} style={{ marginRight: 6 }}>
                        {ev.type === "PROVENTO" ? "+" : "-"}
                      </span>
                      {ev.description}
                    </td>
                    <td>
                      {ev.description.includes("(Relógio REP:") ? (
                        <span className="badge blue">Automático REP</span>
                      ) : (
                        <span className="badge gray">RH</span>
                      )}
                    </td>
                    <td className="num bold">{brl(ev.amount)}</td>
                    <td className="actions">
                      <ConfirmButton
                        action={deletePayrollEventAction.bind(null, ev.id, refMonth)}
                        label="×"
                        className="btn sm danger"
                        confirmText="Remover esta rubrica?"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3 className="mb" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileSpreadsheet size={17} /> Adicionar Bônus, Prêmio ou Desconto Extra Manual
          </h3>
          <p className="small muted mb">
            As Horas Extras do Relógio de Ponto e o Vale de 40% já possuem botões automáticos de 1 clique. Use este formulário apenas para bônus especiais ou descontos avulsos.
          </p>
          <form action={addPayrollEventAction}>
            <input type="hidden" name="month" value={refMonth} />
            <div className="form-grid">
              <div className="field s6">
                <label>Colaborador *</label>
                <select name="employeeId" required>
                  <option value="">Selecione...</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field s6">
                <label>Tipo de Lançamento *</label>
                <select name="category" defaultValue="BONUS_PREMIO">
                  <option value="BONUS_PREMIO">🏆 Bônus / Gratificação (+ Provento)</option>
                  <option value="HORA_EXTRA_100">⏱️ Hora Extra 100% Feriado (+ Provento)</option>
                  <option value="ADICIONAL_NOTURNO">🌙 Adicional Noturno 20% (+ Provento)</option>
                  <option value="ADIANTAMENTO_VALE">💸 Vale Salarial Valor Livre (- Desconto)</option>
                  <option value="FALTA_ATRASO">⚠️ Desconto de Falta (- Desconto)</option>
                </select>
              </div>
              <div className="field s6">
                <label>Valor (R$) *</label>
                <input type="number" name="amount" step="0.01" min="0.01" placeholder="Ex: 350,00" required />
              </div>
              <div className="field s6">
                <label>Referência / Motivo</label>
                <input name="description" placeholder="Opcional (Ex: Meta Batida)" />
              </div>
              <div className="field s12">
                <button type="submit" className="btn secondary">
                  <Plus size={15} /> Incluir no Holerite
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
