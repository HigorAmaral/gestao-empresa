import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { KeyRound, Plus, Printer, Receipt, Shield } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { pageParams, spStr } from "@/lib/form";
import { brl, fmtDate, todayInput } from "@/lib/format";
import { ALL_MODULE_KEYS, getRoleDefinition, parsePermissions } from "@/lib/permissions";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { calculateCompletePayslip } from "@/lib/rh-calc";
import { ActiveBadge, ExportCsvButton, FlashMessages, PageHeader, Pagination } from "@/components/ui";
import { ConfirmButton } from "@/components/Forms";
import { RhSubnav } from "./RhSubnav";
import { deleteEmployee } from "./actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function FuncionariosPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin("funcionarios");
  await ensureStockLocationTables();

  const sp = await searchParams;
  const refMonth = spStr(sp, "month") || todayInput().slice(0, 7);
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

  const [employees, total, departments, allActive] = await Promise.all([
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
      include: { payrollEvents: { where: { month: refMonth } } },
    }),
  ]);

  let totalGross = 0;
  let totalNet = 0;
  let totalFgts = 0;
  for (const emp of allActive) {
    totalGross += emp.salary;
    const calc = calculateCompletePayslip(emp, emp.payrollEvents);
    totalNet += calc.netSalary;
    totalFgts += calc.fgtsAmount;
  }

  return (
    <>
      <PageHeader
        title="Equipe & Prontuários de RH"
        subtitle="Quadro de colaboradores ativos, documentos trabalhistas (PIS/CTPS), jornada e permissões de acesso"
        actions={
          <>
            <ExportCsvButton entity="funcionarios" />
            <Link className="btn secondary" href={`/funcionarios/folha?month=${refMonth}`}>
              <Receipt size={15} /> Ver Folha de Pagamento ({refMonth})
            </Link>
            <Link className="btn" href="/funcionarios/novo">
              <Plus size={15} /> Novo colaborador
            </Link>
          </>
        }
      />
      <FlashMessages sp={sp} />

      <RhSubnav active="equipe" refMonth={refMonth} basePath="/funcionarios" />

      <div className="stats">
        <div className="stat">
          <div className="label">Colaboradores Ativos</div>
          <div className="value">{allActive.length}</div>
          <div className="hint">quadro ativo na empresa</div>
        </div>
        <div className="stat">
          <div className="label">Salários Contratuais (Bruto)</div>
          <div className="value">{brl(totalGross)}</div>
          <div className="hint">soma dos salários base</div>
        </div>
        <div className="stat primary">
          <div className="label">Líquido Calculado ({refMonth})</div>
          <div className="value">{brl(totalNet)}</div>
          <div className="hint">já com Ponto REP, INSS e IRRF</div>
        </div>
        <div className="stat warn">
          <div className="label">FGTS Mensal (8%)</div>
          <div className="value">{brl(totalFgts)}</div>
          <div className="hint">encargo patronal do mês</div>
        </div>
      </div>

      <form className="filters">
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
                <th>Jornada & Horário</th>
                <th>Acesso ao Sistema</th>
                <th>Admissão</th>
                <th className="num">Salário Base</th>
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
                      <div className="muted small">{e.workSchedule || "08:00 às 17:00"}</div>
                    </td>
                    <td>
                      {hasLogin ? (
                        <div>
                          <span className="badge green">
                            <KeyRound size={11} /> {getRoleDefinition(role).shortLabel}
                          </span>
                          <div className="muted small" style={{ marginTop: 3 }}>
                            <Shield size={11} className="icon-inline" /> {perms.length} de {ALL_MODULE_KEYS.length} módulos
                          </div>
                        </div>
                      ) : (
                        <span className="badge gray">Sem login</span>
                      )}
                    </td>
                    <td>{fmtDate(e.hireDate)}</td>
                    <td className="num">{brl(e.salary)}</td>
                    <td className="num bold">
                      {brl(calc.netSalary)}
                    </td>
                    <td>
                      <ActiveBadge active={e.active} />
                    </td>
                    <td className="actions">
                      <Link
                        className="btn sm"
                        href={`/funcionarios/${e.id}/recibo?mes=${refMonth}`}
                        title="Emitir Holerite Oficial Completo"
                      >
                        <Printer size={13} /> Holerite
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
  );
}
