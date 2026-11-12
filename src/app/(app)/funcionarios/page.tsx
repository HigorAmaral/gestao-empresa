import Link from "next/link";
import type { Prisma } from "@prisma/client";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Cpu,
  FileSpreadsheet,
  HeartPulse,
  KeyRound,
  Plus,
  Printer,
  RefreshCw,
  Shield,
  ShieldCheck,
  Upload,
  Users,
  Wallet,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { pageParams, spStr } from "@/lib/form";
import { brl, fmtDate, todayInput } from "@/lib/format";
import { ALL_MODULE_KEYS, parsePermissions } from "@/lib/permissions";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { calculateCompletePayslip } from "@/lib/rh-calc";
import { ActiveBadge, ExportCsvButton, FlashMessages, PageHeader, Pagination } from "@/components/ui";
import { ActionForm, ConfirmButton } from "@/components/Forms";
import {
  addPayrollEventAction,
  createEmployeeLeaveAction,
  createSafetyRecordAction,
  createTimeClockMachineAction,
  deleteEmployee,
  deleteEmployeeLeaveAction,
  deletePayrollEventAction,
  deleteSafetyRecordAction,
  deleteTimeClockMachineAction,
  generatePayroll,
  importAfdFileAction,
  syncRepMachineNowAction,
  transferRepToPayrollAction,
} from "./actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

function fmtMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return `${h}h${String(rem).padStart(2, "0")}m`;
}

export default async function FuncionariosPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin("funcionarios");
  await ensureStockLocationTables();

  const sp = await searchParams;
  const tab = spStr(sp, "tab") || "folha";
  const refMonth = spStr(sp, "month") || todayInput().slice(0, 7);
  const [ry, rm] = refMonth.split("-").map(Number);
  const startOfMonth = new Date(Date.UTC(ry, rm - 1, 1, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(ry, rm, 0, 23, 59, 59));

  const q = spStr(sp, "q");
  const department = spStr(sp, "department");
  const status = spStr(sp, "status") || "ativos";
  const { page, skip, take, pageSize } = pageParams(sp);

  const where: Prisma.EmployeeWhereInput = {
    ...(q && { OR: [{ name: { contains: q } }, { position: { contains: q } }, { email: { contains: q } }] }),
    ...(department && { department }),
    ...(status === "ativos" && { active: true }),
    ...(status === "inativos" && { active: false }),
  };

  const [
    employees,
    total,
    departments,
    allActiveEmployees,
    machines,
    clockLogs,
    monthEvents,
    leaves,
    safetyRecords,
  ] = await Promise.all([
    prisma.employee.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take,
      include: {
        user: true,
        payrollEvents: { where: { month: refMonth } },
      },
    }),
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where: { department: { not: null } },
      distinct: ["department"],
      select: { department: true },
    }),
    prisma.employee.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: {
        payrollEvents: { where: { month: refMonth } },
      },
    }),
    prisma.timeClockMachine.findMany({ orderBy: { id: "asc" } }),
    prisma.timeClockLog.findMany({
      where: { date: { gte: startOfMonth, lte: endOfMonth } },
      include: { employee: true, machine: true },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: 150,
    }),
    prisma.employeePayrollEvent.findMany({
      where: { month: refMonth },
      include: { employee: true },
      orderBy: { id: "desc" },
    }),
    prisma.employeeLeave.findMany({
      include: { employee: true },
      orderBy: { startDate: "desc" },
      take: 60,
    }),
    prisma.employeeSafetyRecord.findMany({
      include: { employee: true },
      orderBy: { issuedAt: "desc" },
      take: 80,
    }),
  ]);

  // Cálculos consolidados da folha do mês
  let totalGrossBase = 0;
  let totalNetPayroll = 0;
  let totalFgtsMonth = 0;
  let totalInssIrrf = 0;
  let totalProvisions = 0;

  for (const emp of allActiveEmployees) {
    totalGrossBase += emp.salary;
    const calc = calculateCompletePayslip(emp, emp.payrollEvents);
    totalNetPayroll += calc.netSalary;
    totalFgtsMonth += calc.fgtsAmount;
    totalInssIrrf += calc.inssAmount + calc.irrfAmount;
    totalProvisions += calc.provision13th + calc.provisionVacation;
  }

  const totalOvertimeMinMonth = clockLogs.reduce((s, l) => s + (l.overtimeMinutes || 0), 0);
  const totalLateMinMonth = clockLogs.reduce((s, l) => s + (l.lateMinutes || 0), 0);

  return (
    <>
      <PageHeader
        title="RH & Departamento Pessoal"
        subtitle="Folha de pagamento CLT/PJ, sincronização com Relógio de Ponto Físico (REP), Férias e Segurança do Trabalho (SST)"
        actions={
          <>
            <ExportCsvButton entity="funcionarios" />
            <Link className="btn" href="/funcionarios/novo">
              <Plus size={15} /> Novo colaborador
            </Link>
          </>
        }
      />
      <FlashMessages sp={sp} />

      {/* Navegação por Abas do Módulo de RH & DP */}
      <div
        className="card mb"
        style={{
          padding: "10px 14px",
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Link
            href={`/funcionarios?tab=folha&month=${refMonth}`}
            className={`btn ${tab === "folha" ? "" : "secondary"}`}
          >
            <Users size={15} /> Colaboradores & Folha ({allActiveEmployees.length})
          </Link>
          <Link
            href={`/funcionarios?tab=ponto&month=${refMonth}`}
            className={`btn ${tab === "ponto" ? "" : "secondary"}`}
          >
            <Cpu size={15} /> Relógio de Ponto (REP) & Espelho ({clockLogs.length})
          </Link>
          <Link
            href={`/funcionarios?tab=ferias&month=${refMonth}`}
            className={`btn ${tab === "ferias" ? "" : "secondary"}`}
          >
            <Calendar size={15} /> Férias, Atestados & Licenças ({leaves.length})
          </Link>
          <Link
            href={`/funcionarios?tab=sst&month=${refMonth}`}
            className={`btn ${tab === "sst" ? "" : "secondary"}`}
          >
            <ShieldCheck size={15} /> EPIs & Exames ASO ({safetyRecords.length})
          </Link>
        </div>

        <form method="GET" action="/funcionarios" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="hidden" name="tab" value={tab} />
          <span className="small muted bold">Competência:</span>
          <input
            type="month"
            name="month"
            defaultValue={refMonth}
            style={{ width: 155, padding: "6px 10px" }}
          />
          <button type="submit" className="btn sm secondary">
            Alternar Mês
          </button>
        </form>
      </div>

      {/* =====================================================================
          ABA 1: QUADRO DE COLABORADORES, FOLHA LÍQUIDA & VALE QUINZENAL
         ===================================================================== */}
      {tab === "folha" && (
        <>
          <div className="stats">
            <div className="stat">
              <div className="label">Colaboradores Ativos</div>
              <div className="value">{allActiveEmployees.length}</div>
              <div className="hint">quadro ativo na empresa</div>
            </div>
            <div className="stat">
              <div className="label">Folha Salarial Bruta (Base)</div>
              <div className="value">{brl(totalGrossBase)}</div>
              <div className="hint">soma dos salários contratuais</div>
            </div>
            <div className="stat primary">
              <div className="label">Folha Líquida a Pagar ({refMonth})</div>
              <div className="value">{brl(totalNetPayroll)}</div>
              <div className="hint">após INSS, IRRF, VT, Vales e Extras</div>
            </div>
            <div className="stat warn">
              <div className="label">FGTS + Retenções + Provisões</div>
              <div className="value">{brl(totalFgtsMonth + totalInssIrrf)}</div>
              <div className="hint">
                FGTS 8%: {brl(totalFgtsMonth)} · Prov. 13º/Férias: {brl(totalProvisions)}
              </div>
            </div>
          </div>

          <div className="grid grid-2 mb">
            {/* Fechamento da Folha Mensal no Financeiro */}
            <div className="card">
              <h2 className="mb" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Wallet size={18} /> Fechar Folha de Pagamento no Financeiro
              </h2>
              <p className="small muted mb">
                Calcula automaticamente o <strong>Salário Líquido</strong> de cada colaborador (somando Horas Extras vindas do Relógio de Ponto e descontando INSS Progressivo, IRRF, VT 6% e Vales Quinzenais já adiantados).
              </p>
              <ActionForm action={generatePayroll} submitLabel="Processar Folha Líquida no Financeiro">
                <div className="form-grid">
                  <div className="field s6">
                    <label>Mês de competência</label>
                    <input type="month" name="month" defaultValue={refMonth} required />
                  </div>
                  <div className="field s6">
                    <label>Dia de pagamento (mês seguinte)</label>
                    <input type="number" name="day" min="1" max="28" defaultValue={5} />
                  </div>
                  <div className="field s12">
                    <label className="checkbox">
                      <input type="checkbox" name="includeGuides" defaultChecked /> Gerar também títulos de impostos (Guia FGTS Digital 8% e DARF Previdenciário INSS/IRRF)
                    </label>
                  </div>
                </div>
              </ActionForm>
            </div>

            {/* Lançamento Rápido de Vale Quinzenal / Bônus / Faltas */}
            <div className="card">
              <h2 className="mb" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FileSpreadsheet size={18} /> Lançar Vale Quinzenal (Adiantamento) ou Evento na Folha
              </h2>
              <form action={addPayrollEventAction}>
                <input type="hidden" name="month" value={refMonth} />
                <div className="form-grid">
                  <div className="field s6">
                    <label>Colaborador *</label>
                    <select name="employeeId" required>
                      <option value="">Selecione...</option>
                      {allActiveEmployees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name} — Base {brl(e.salary)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field s6">
                    <label>Tipo de Rubrica *</label>
                    <select name="category" defaultValue="ADIANTAMENTO_VALE">
                      <option value="ADIANTAMENTO_VALE">💸 Vale Quinzenal / Adiantamento (Gera Despesa + Desconto)</option>
                      <option value="BONUS_PREMIO">🏆 Bônus / Gratificação / Prêmio (+ Provento)</option>
                      <option value="HORA_EXTRA_50">⏱️ Horas Extras 50% Manual (+ Provento)</option>
                      <option value="HORA_EXTRA_100">⏱️ Horas Extras 100% Feriado (+ Provento)</option>
                      <option value="ADICIONAL_NOTURNO">🌙 Adicional Noturno 20% (+ Provento)</option>
                      <option value="FALTA_ATRASO">⚠️ Desconto de Falta Injustificada (- Desconto)</option>
                      <option value="OUTROS_DESCONTOS">➖ Outros Descontos Autorizados (- Desconto)</option>
                    </select>
                  </div>
                  <div className="field s4">
                    <label>Valor (R$) *</label>
                    <input type="number" name="amount" step="0.01" min="0.01" placeholder="Ex: 800,00" required />
                  </div>
                  <div className="field s4">
                    <label>Referência (Opcional)</label>
                    <input name="reference" placeholder="Ex: 40%, 5h, 1 dia" />
                  </div>
                  <div className="field s4">
                    <label>Descrição customizada</label>
                    <input name="description" placeholder="Padrão da rubrica" />
                  </div>
                  <div className="field s12">
                    <button type="submit" className="btn">
                      <Plus size={15} /> Lançar no Holerite de {refMonth}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Rubricas / Vales Lançados no Mês */}
          {monthEvents.length > 0 && (
            <div className="card flush mb">
              <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>Rubricas Variáveis, Vales e Horas Extras lançados na Competência {refMonth}</strong>
                <span className="badge blue">{monthEvents.length} lançamento(s)</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Colaborador</th>
                      <th>Tipo</th>
                      <th>Rubrica / Descrição</th>
                      <th>Ref.</th>
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
                          <span className={`badge ${ev.type === "PROVENTO" ? "green" : "red"}`}>
                            {ev.type}
                          </span>
                        </td>
                        <td>{ev.description}</td>
                        <td>{ev.reference || "—"}</td>
                        <td>
                          {ev.description.includes("(Relógio REP:") ? (
                            <span className="badge blue">Relógio de Ponto (REP)</span>
                          ) : ev.financialId ? (
                            <span className="badge yellow">Integrado ao Financeiro</span>
                          ) : (
                            <span className="muted small">Manual RH</span>
                          )}
                        </td>
                        <td className="num bold">{brl(ev.amount)}</td>
                        <td className="actions">
                          <ConfirmButton
                            action={deletePayrollEventAction.bind(null, ev.id, refMonth)}
                            label="Remover"
                            className="btn sm danger"
                            confirmText="Remover esta rubrica do holerite?"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Filtros do Quadro de Colaboradores */}
          <form className="filters">
            <input type="hidden" name="tab" value="folha" />
            <input type="hidden" name="month" value={refMonth} />
            <input className="grow" name="q" placeholder="Buscar por nome, cargo ou e-mail..." defaultValue={q} />
            <select name="department" defaultValue={department}>
              <option value="">Todos os departamentos</option>
              {departments.map((d) => (
                <option key={d.department}>{d.department}</option>
              ))}
            </select>
            <select name="status" defaultValue={status}>
              <option value="todos">Todos</option>
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
            </select>
            <button className="btn secondary">Filtrar</button>
          </form>

          <div className="card flush">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Colaborador / PIS</th>
                    <th>Cargo & Regime</th>
                    <th>Jornada</th>
                    <th>Acesso ao Sistema</th>
                    <th className="num">Salário Base</th>
                    <th className="num">INSS / IRRF</th>
                    <th className="num">Líquido ({refMonth})</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => {
                    const hasLogin = Boolean(e.user && e.user.active);
                    const role = e.user?.role ?? "FUNCIONARIO";
                    const perms = parsePermissions(e.user?.permissions ?? e.permissions, role);
                    const calc = calculateCompletePayslip(e, e.payrollEvents);
                    return (
                      <tr key={e.id}>
                        <td>
                          <div className="bold">
                            <Link href={`/funcionarios/${e.id}`}>{e.name}</Link>
                          </div>
                          <div className="muted small">
                            CPF: {e.document || "—"} {e.pis ? `· PIS: ${e.pis}` : ""}
                          </div>
                        </td>
                        <td>
                          <div>{e.position}</div>
                          <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
                            <span className="badge blue">{e.contractType || "CLT"}</span>
                            {e.department && <span className="badge gray">{e.department}</span>}
                          </div>
                        </td>
                        <td>
                          <div className="small">{e.workHoursPerDay || 8}h/dia</div>
                          <div className="muted small">{e.workSchedule || "08:00-17:00"}</div>
                        </td>
                        <td>
                          {hasLogin ? (
                            <div>
                              <span className="badge green">
                                <KeyRound size={11} /> {role === "ADMIN" ? "Admin (Total)" : "Login Ativo"}
                              </span>
                              <div className="muted small" style={{ marginTop: 3 }}>
                                <Shield size={11} className="icon-inline" /> {perms.length} de {ALL_MODULE_KEYS.length} módulos
                              </div>
                            </div>
                          ) : (
                            <span className="badge gray">Sem login</span>
                          )}
                        </td>
                        <td className="num">{brl(e.salary)}</td>
                        <td className="num small muted">
                          -{brl(calc.inssAmount + calc.irrfAmount)}
                          <div className="small">FGTS: {brl(calc.fgtsAmount)}</div>
                        </td>
                        <td className="num bold" style={{ color: "var(--success, #22c55e)" }}>
                          {brl(calc.netSalary)}
                        </td>
                        <td>
                          <ActiveBadge active={e.active} />
                        </td>
                        <td className="actions">
                          <Link
                            className="btn sm"
                            href={`/funcionarios/${e.id}/recibo?mes=${refMonth}`}
                            title="Emitir Holerite Oficial Completo com INSS, IRRF, FGTS e Horas Extras"
                          >
                            <Printer size={13} /> Holerite Oficial
                          </Link>
                          <Link className="btn sm secondary" href={`/funcionarios/${e.id}`}>
                            Prontuário / Editar
                          </Link>
                          <ConfirmButton
                            action={deleteEmployee.bind(null, e.id)}
                            label="Excluir"
                            className="btn sm danger"
                            confirmText={`Excluir o colaborador "${e.name}"?`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {employees.length === 0 && (
                    <tr>
                      <td colSpan={9} className="empty">
                        Nenhum colaborador encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination basePath="/funcionarios" sp={sp} page={page} pageSize={pageSize} total={total} />
          </div>
        </>
      )}

      {/* =====================================================================
          ABA 2: RELÓGIO DE PONTO FÍSICO (REP) & ESPELHO DE PONTO
         ===================================================================== */}
      {tab === "ponto" && (
        <>
          <div className="stats">
            <div className="stat primary">
              <div className="label">Máquinas REP Configuradas</div>
              <div className="value">{machines.length}</div>
              <div className="hint">Portaria 671 & 1510 MTE</div>
            </div>
            <div className="stat">
              <div className="label">Batidas Sincronizadas ({refMonth})</div>
              <div className="value">{clockLogs.length} dias</div>
              <div className="hint">recebidas dos relógios físicos</div>
            </div>
            <div className="stat">
              <div className="label">Horas Extras Acumuladas ({refMonth})</div>
              <div className="value" style={{ color: "var(--success, #22c55e)" }}>
                {fmtMinutes(totalOvertimeMinMonth)}
              </div>
              <div className="hint">prontas para integrar na folha</div>
            </div>
            <div className="stat warn">
              <div className="label">Atrasos / Saídas Antecipadas ({refMonth})</div>
              <div className="value">{fmtMinutes(totalLateMinMonth)}</div>
              <div className="hint">apurados pelo relógio de ponto</div>
            </div>
          </div>

          {/* Lista de Máquinas de Ponto Físicas Configuradas */}
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
                <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <Cpu size={18} /> Máquinas de Bater Ponto Conectadas (Relógios REP Físicos)
                </h2>
                <div className="small muted">
                  Configure os relógios biométricos/faciais da empresa. Quando o colaborador bate o ponto na máquina, o sistema recebe as batidas via Webhook em tempo real, Sincronização IP ou Arquivo AFD e calcula a folha automaticamente.
                </div>
              </div>
              <form action={transferRepToPayrollAction}>
                <input type="hidden" name="month" value={refMonth} />
                <button type="submit" className="btn">
                  <CheckCircle2 size={15} /> Integrar Ponto → Lançar Horas Extras e Atrasos na Folha ({refMonth})
                </button>
              </form>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Equipamento / Local</th>
                    <th>Fabricante & Modelo</th>
                    <th>Rede (IP : Porta) / Nº Série REP</th>
                    <th>Webhook API & Token (Push Automático)</th>
                    <th>Última Sincronização</th>
                    <th>Ações de Sincronização</th>
                  </tr>
                </thead>
                <tbody>
                  {machines.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="bold">{m.name}</div>
                        <div className="small muted">Local: {m.location || "Portaria"}</div>
                      </td>
                      <td>
                        <span className="badge blue">{m.brand}</span>
                        <div className="small muted" style={{ marginTop: 3 }}>
                          {m.model || "REP-C Biométrico"}
                        </div>
                      </td>
                      <td>
                        <div className="mono small">
                          {m.ipAddress || "192.168.1.201"}:{m.port || 80}
                        </div>
                        <div className="small muted">Série: {m.serialNumber || "Não informado"}</div>
                      </td>
                      <td>
                        <div className="mono small" style={{ fontSize: 11 }}>
                          POST /api/rep/sync
                        </div>
                        <div className="mono small muted" style={{ fontSize: 11 }}>
                          Token: <strong>{m.apiToken}</strong>
                        </div>
                      </td>
                      <td>
                        {m.lastSyncAt ? (
                          <div>
                            <span className="badge green">Online · Sincronizado</span>
                            <div className="small muted" style={{ marginTop: 3 }}>
                              {new Date(m.lastSyncAt).toLocaleString("pt-BR")} ({m.totalSynced} reg.)
                            </div>
                          </div>
                        ) : (
                          <span className="badge yellow">Aguardando 1ª Sincronização</span>
                        )}
                      </td>
                      <td className="actions">
                        <form action={syncRepMachineNowAction} style={{ display: "inline" }}>
                          <input type="hidden" name="machineId" value={m.id} />
                          <input type="hidden" name="month" value={refMonth} />
                          <button type="submit" className="btn sm">
                            <RefreshCw size={13} /> Sincronizar Máquina Agora
                          </button>
                        </form>
                        <ConfirmButton
                          action={deleteTimeClockMachineAction.bind(null, m.id)}
                          label="Remover"
                          className="btn sm danger"
                          confirmText={`Remover o relógio "${m.name}"?`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cadastro de Nova Máquina REP + Importação de Arquivo AFD */}
          <div className="grid grid-2 mb">
            <div className="card">
              <h2 className="mb" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Plus size={18} /> Cadastrar Nova Máquina de Ponto (REP)
              </h2>
              <form action={createTimeClockMachineAction}>
                <div className="form-grid">
                  <div className="field s6">
                    <label>Nome / Identificação do Relógio *</label>
                    <input name="name" placeholder="Ex: Relógio Produção Galpão 2" required />
                  </div>
                  <div className="field s6">
                    <label>Fabricante (Protocolo de Integração) *</label>
                    <select name="brand" defaultValue="CONTROL_ID">
                      <option value="CONTROL_ID">Control iD (iDClass / iDFace / iDAccess)</option>
                      <option value="HENRY">Henry (Prisma Super Fácil / Hexa / Orion)</option>
                      <option value="TOPDATA">Topdata (Inner Rep Plus / Inner Net)</option>
                      <option value="DIMEP">Dimep (PrintPoint II / III / Kairos)</option>
                      <option value="INTELBRAS">Intelbras / Proveu (Kurumin)</option>
                    </select>
                  </div>
                  <div className="field s4">
                    <label>Modelo do Equipamento</label>
                    <input name="model" placeholder="Ex: iDClass Bio 671" />
                  </div>
                  <div className="field s4">
                    <label>Nº de Série REP (17 dígitos)</label>
                    <input name="serialNumber" placeholder="00014002750019821" />
                  </div>
                  <div className="field s4">
                    <label>Local de Instalação</label>
                    <input name="location" placeholder="Ex: Recepção / Fábrica" />
                  </div>
                  <div className="field s6">
                    <label>Endereço IP na Rede Local</label>
                    <input name="ipAddress" placeholder="Ex: 192.168.1.202" />
                  </div>
                  <div className="field s6">
                    <label>Porta TCP/HTTP</label>
                    <input type="number" name="port" defaultValue={80} />
                  </div>
                  <div className="field s12">
                    <button type="submit" className="btn">
                      <Plus size={15} /> Salvar Equipamento e Gerar Token de Sincronização
                    </button>
                  </div>
                </div>
              </form>
            </div>

            <div className="card">
              <h2 className="mb" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Upload size={18} /> Importar Arquivo AFD (.txt / .afd) ou Batidas da Máquina
              </h2>
              <p className="small muted mb">
                Se a máquina estiver offline ou sem rede, exporte o <strong>Arquivo Fonte de Dados (AFD — Portaria 1510 ou 671 MTE)</strong> pelo pen-drive do relógio ou cole as marcações abaixo (`PIS;AAAA-MM-DD;HH:MM` ou linha Tipo 3 AFD).
              </p>
              <form action={importAfdFileAction}>
                <input type="hidden" name="month" value={refMonth} />
                <div className="form-grid">
                  <div className="field s12">
                    <label>Vincular ao Relógio</label>
                    <select name="machineId">
                      {machines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.brand})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field s12">
                    <label>Conteúdo do Arquivo AFD (Portaria 1510/671) ou CSV de Batidas *</label>
                    <textarea
                      name="afdContent"
                      rows={4}
                      placeholder={
                        "Exemplo AFD Portaria 671:\n00001050032026-11-12T08:00:00-030012345678901\nOu formato simplificado:\n12345678901;2026-11-12;08:00;12:00;13:00;18:10"
                      }
                      required
                    />
                  </div>
                  <div className="field s12">
                    <button type="submit" className="btn secondary">
                      <Upload size={15} /> Processar Batidas AFD e Calcular Horas
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Espelho de Ponto Recebido das Máquinas REP */}
          <div className="card flush">
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>Espelho de Ponto Eletrônico Sincronizado — Competência {refMonth}</strong>
              <span className="small muted">Tolerância legal CLT (Art. 58 §1º): 10 min diários</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Colaborador</th>
                    <th>Relógio Origem / NSR</th>
                    <th>Entrada 1</th>
                    <th>Saída Almoço</th>
                    <th>Retorno Almoço</th>
                    <th>Saída 2</th>
                    <th className="num">Trabalhado</th>
                    <th className="num">Hora Extra (+50%)</th>
                    <th className="num">Atraso / Falta</th>
                  </tr>
                </thead>
                <tbody>
                  {clockLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="mono bold">{fmtDate(log.date)}</td>
                      <td className="bold">{log.employee.name}</td>
                      <td>
                        <div className="small">{log.machine?.name || log.source}</div>
                        {log.nsr && <div className="mono small muted">NSR #{log.nsr}</div>}
                      </td>
                      <td className="mono">{log.checkIn1 || "—"}</td>
                      <td className="mono">{log.checkOut1 || "—"}</td>
                      <td className="mono">{log.checkIn2 || "—"}</td>
                      <td className="mono">{log.checkOut2 || "—"}</td>
                      <td className="num bold">{fmtMinutes(log.workedMinutes)}</td>
                      <td className="num">
                        {log.overtimeMinutes > 0 ? (
                          <span className="badge green">+{fmtMinutes(log.overtimeMinutes)}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="num">
                        {log.lateMinutes > 0 ? (
                          <span className="badge red">-{fmtMinutes(log.lateMinutes)}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {clockLogs.length === 0 && (
                    <tr>
                      <td colSpan={10} className="empty">
                        Nenhuma batida sincronizada em {refMonth}. Clique em <strong>&quot;Sincronizar Máquina Agora&quot;</strong> no quadro acima para buscar as batidas do Relógio de Ponto!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* =====================================================================
          ABA 3: GESTÃO DE FÉRIAS, ATESTADOS MÉDICOS E AFASTAMENTOS
         ===================================================================== */}
      {tab === "ferias" && (
        <>
          <div className="grid grid-2 mb">
            {/* Painel Automático de Período Aquisitivo e Concessivo */}
            <div className="card flush">
              <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
                <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <Clock size={18} /> Controle de Período Aquisitivo e Concessivo de Férias (CLT)
                </h2>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Colaborador</th>
                      <th>Admissão</th>
                      <th>Tempo de Casa</th>
                      <th>Status do Ciclo de Férias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allActiveEmployees.map((emp) => {
                      const hire = new Date(emp.hireDate);
                      const now = new Date();
                      const monthsWorked = Math.max(
                        0,
                        (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth())
                      );
                      const cycleMonths = monthsWorked % 12;
                      const completedYears = Math.floor(monthsWorked / 12);

                      let badgeClass = "blue";
                      let statusText = `Em Aquisição (${cycleMonths}/12 avos)`;
                      if (monthsWorked >= 22) {
                        badgeClass = "red";
                        statusText = "⚠️ Limite Concessivo Próximo (Risco Dobro)";
                      } else if (completedYears >= 1) {
                        badgeClass = "yellow";
                        statusText = `Período Concessivo Aberto (${completedYears}º ciclo adquirido)`;
                      }

                      return (
                        <tr key={emp.id}>
                          <td className="bold">{emp.name}</td>
                          <td>{fmtDate(emp.hireDate)}</td>
                          <td>{monthsWorked} meses</td>
                          <td>
                            <span className={`badge ${badgeClass}`}>{statusText}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Formulário de Registro de Férias / Atestado / Licença */}
            <div className="card">
              <h2 className="mb" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Calendar size={18} /> Registrar Férias, Atestado Médico ou Licença
              </h2>
              <form action={createEmployeeLeaveAction}>
                <div className="form-grid">
                  <div className="field s6">
                    <label>Colaborador *</label>
                    <select name="employeeId" required>
                      <option value="">Selecione...</option>
                      {allActiveEmployees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field s6">
                    <label>Tipo de Ocorrência *</label>
                    <select name="type" defaultValue="FERIAS">
                      <option value="FERIAS">🏖️ Férias Regulamentares (com 1/3 Constitucional)</option>
                      <option value="ATESTADO_MEDICO">🏥 Atestado Médico Abonado</option>
                      <option value="LICENCA">👶 Licença Maternidade / Paternidade / Remunerada</option>
                      <option value="AFASTAMENTO_INSS">🏛️ Afastamento Previdenciário (INSS &gt; 15 dias)</option>
                      <option value="FALTA_JUSTIFICADA">📋 Ausência Legal Justificada (Casamento, Luto, Doação)</option>
                    </select>
                  </div>
                  <div className="field s6">
                    <label>Data de Início *</label>
                    <input type="date" name="startDate" defaultValue={todayInput()} required />
                  </div>
                  <div className="field s6">
                    <label>Data de Retorno / Término *</label>
                    <input type="date" name="endDate" defaultValue={todayInput()} required />
                  </div>
                  <div className="field s4">
                    <label>Código CID (Se Atestado)</label>
                    <input name="cidCode" placeholder="Ex: J00, M54" />
                  </div>
                  <div className="field s4">
                    <label>Médico / CRM</label>
                    <input name="doctorName" placeholder="Ex: Dr. Marcos CRM 12345" />
                  </div>
                  <div className="field s4">
                    <label>Valor Férias + 1/3 (R$)</label>
                    <input type="number" step="0.01" name="paidBonus" defaultValue={0} />
                  </div>
                  <div className="field s12">
                    <label>Observações</label>
                    <input name="notes" placeholder="Ex: Abono pecuniário de 10 dias vendido / clínica emissora" />
                  </div>
                  <div className="field s12">
                    <button type="submit" className="btn">
                      <Plus size={15} /> Salvar Registro
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          <div className="card flush">
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
              <strong>Histórico de Férias, Atestados Médicos e Afastamentos</strong>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Tipo</th>
                    <th>Período</th>
                    <th className="num">Dias</th>
                    <th>CID / Médico</th>
                    <th className="num">Valor Férias Pago</th>
                    <th>Observações</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((lv) => (
                    <tr key={lv.id}>
                      <td className="bold">{lv.employee.name}</td>
                      <td>
                        <span className={`badge ${lv.type === "FERIAS" ? "blue" : lv.type.includes("ATESTADO") ? "yellow" : "gray"}`}>
                          {lv.type}
                        </span>
                      </td>
                      <td>
                        {fmtDate(lv.startDate)} até {fmtDate(lv.endDate)}
                      </td>
                      <td className="num bold">{lv.days}d</td>
                      <td>
                        {lv.cid || lv.doctorName ? (
                          <span className="small">
                            {lv.cid ? `CID ${lv.cid}` : ""} {lv.doctorName ? `· ${lv.doctorName}` : ""}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="num">{(lv.vacationPay ?? 0) > 0 ? brl(lv.vacationPay!) : "—"}</td>
                      <td className="small muted">{lv.notes || "—"}</td>
                      <td className="actions">
                        <ConfirmButton
                          action={deleteEmployeeLeaveAction.bind(null, lv.id)}
                          label="Excluir"
                          className="btn sm danger"
                          confirmText="Excluir este registro?"
                        />
                      </td>
                    </tr>
                  ))}
                  {leaves.length === 0 && (
                    <tr>
                      <td colSpan={8} className="empty">
                        Nenhum registro de férias ou atestado médico cadastrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* =====================================================================
          ABA 4: SEGURANÇA DO TRABALHO (SST) — EPIs & EXAMES ASO
         ===================================================================== */}
      {tab === "sst" && (
        <>
          <div className="card mb">
            <h2 className="mb" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <HeartPulse size={18} /> Registrar Entrega de EPI (com CA) ou Exame Ocupacional (ASO)
            </h2>
            <form action={createSafetyRecordAction}>
              <div className="form-grid">
                <div className="field s4">
                  <label>Colaborador *</label>
                  <select name="employeeId" required>
                    <option value="">Selecione...</option>
                    {allActiveEmployees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.position})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field s4">
                  <label>Categoria de Registro SST *</label>
                  <select name="recordType" defaultValue="EPI">
                    <option value="EPI">🦺 Entrega de EPI (Equipamento de Proteção Individual)</option>
                    <option value="ASO_ADMISSIONAL">🩺 ASO — Exame Admissional</option>
                    <option value="ASO_PERIODICO">🩺 ASO — Exame Periódico Anual</option>
                    <option value="ASO_MUDANCA_FUNCAO">🩺 ASO — Mudança de Riscos / Função</option>
                    <option value="ASO_RETORNO">🩺 ASO — Retorno ao Trabalho</option>
                    <option value="ASO_DEMISSIONAL">🩺 ASO — Exame Demissional</option>
                  </select>
                </div>
                <div className="field s4">
                  <label>Descrição do EPI ou Exame Realizado *</label>
                  <input name="itemName" placeholder="Ex: Botina de Segurança Bico Composite / Audiometria + Clínico" required />
                </div>
                <div className="field s2">
                  <label>Nº do CA (Cert. Aprovação)</label>
                  <input name="caNumber" placeholder="Ex: 42189" />
                </div>
                <div className="field s2">
                  <label>Qtd. Entregue</label>
                  <input type="number" name="quantity" min="1" defaultValue={1} />
                </div>
                <div className="field s3">
                  <label>Data de Entrega / Exame *</label>
                  <input type="date" name="deliveryDate" defaultValue={todayInput()} required />
                </div>
                <div className="field s3">
                  <label>Validade / Próxima Renovação</label>
                  <input type="date" name="expiryDate" />
                </div>
                <div className="field s2">
                  <label>Status / Parecer</label>
                  <select name="resultStatus" defaultValue="VIGENTE">
                    <option value="VIGENTE">VIGENTE / APTO</option>
                    <option value="APTO_COM_RESTRICAO">APTO C/ RESTRIÇÃO</option>
                    <option value="DEVOLVIDO">DEVOLVIDO</option>
                  </select>
                </div>
                <div className="field s6">
                  <label>Clínica de Medicina do Trabalho / Médico Coordenador PCMSO</label>
                  <input name="doctorOrClinic" placeholder="Ex: Clínica Vida Ocupacional — Dr. Roberto (CRM 54321)" />
                </div>
                <div className="field s6">
                  <label>Observações da Ficha (NR-06 / NR-07)</label>
                  <input name="notes" placeholder="Ex: Colaborador recebeu treinamento de uso e conservação" />
                </div>
                <div className="field s12">
                  <button type="submit" className="btn">
                    <Plus size={15} /> Registrar na Ficha de SST do Colaborador
                  </button>
                </div>
              </div>
            </form>
          </div>

          <div className="card flush">
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
              <strong>Controle de Fichas de EPIs (NR-06) e Exames Ocupacionais ASO (NR-07 / eSocial S-2220 & S-2240)</strong>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Tipo</th>
                    <th>EPI / Exame Ocupacional</th>
                    <th>Nº CA / Observações</th>
                    <th className="num">Qtd.</th>
                    <th>Data Emissão</th>
                    <th>Validade / Vencimento</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {safetyRecords.map((rec) => {
                    const isExpired = rec.expiresAt && new Date(rec.expiresAt) < new Date();
                    return (
                      <tr key={rec.id}>
                        <td className="bold">{rec.employee.name}</td>
                        <td>
                          <span className={`badge ${rec.recordType === "EPI" ? "blue" : "green"}`}>
                            {rec.recordType}
                          </span>
                        </td>
                        <td className="bold">{rec.title}</td>
                        <td>
                          {rec.caNumber && <span className="mono badge gray">CA {rec.caNumber}</span>}{" "}
                          <span className="small muted">{rec.notes || ""}</span>
                        </td>
                        <td className="num">{rec.quantity}</td>
                        <td>{fmtDate(rec.issuedAt)}</td>
                        <td>
                          {rec.expiresAt ? (
                            <span className={`badge ${isExpired ? "red" : "green"}`}>
                              {isExpired && <AlertTriangle size={11} />} {fmtDate(rec.expiresAt)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <span className="badge green">{rec.status || "VIGENTE"}</span>
                        </td>
                        <td className="actions">
                          <ConfirmButton
                            action={deleteSafetyRecordAction.bind(null, rec.id)}
                            label="Remover"
                            className="btn sm danger"
                            confirmText="Remover este registro de SST?"
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {safetyRecords.length === 0 && (
                    <tr>
                      <td colSpan={9} className="empty">
                        Nenhum EPI ou Exame ASO registrado ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
