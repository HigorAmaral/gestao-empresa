import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { KeyRound, Plus, Shield } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { pageParams, spStr } from "@/lib/form";
import { brl, fmtDate, todayInput } from "@/lib/format";
import { ALL_MODULE_KEYS, parsePermissions } from "@/lib/permissions";
import { ActiveBadge, ExportCsvButton, FlashMessages, PageHeader, Pagination } from "@/components/ui";
import { ActionForm, ConfirmButton } from "@/components/Forms";
import { deleteEmployee, generatePayroll } from "./actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function FuncionariosPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin("funcionarios");
  const sp = await searchParams;
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

  const [employees, total, departments, payroll] = await Promise.all([
    prisma.employee.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take,
      include: { user: true },
    }),
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where: { department: { not: null } },
      distinct: ["department"],
      select: { department: true },
    }),
    prisma.employee.aggregate({
      where: { active: true },
      _sum: { salary: true },
      _count: true,
      _avg: { salary: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Funcionários"
        subtitle="Recursos humanos, acessos ao sistema e folha de pagamento"
        actions={
          <>
            <ExportCsvButton entity="funcionarios" />
            <Link className="btn" href="/funcionarios/novo">
              <Plus size={15} /> Novo funcionário
            </Link>
          </>
        }
      />
      <FlashMessages sp={sp} />

      <div className="grid grid-2 mb">
        <div className="stats" style={{ marginBottom: 0 }}>
          <div className="stat">
            <div className="label">Funcionários ativos</div>
            <div className="value">{payroll._count}</div>
          </div>
          <div className="stat primary">
            <div className="label">Folha mensal</div>
            <div className="value">{brl(payroll._sum.salary)}</div>
            <div className="hint">média {brl(payroll._avg.salary)}</div>
          </div>
        </div>
        <div className="card">
          <h2 className="mb">Gerar folha de pagamento no financeiro</h2>
          <ActionForm action={generatePayroll} submitLabel="Gerar despesas">
            <div className="form-grid">
              <div className="field">
                <label>Mês de referência</label>
                <input type="month" name="month" defaultValue={todayInput().slice(0, 7)} required />
              </div>
              <div className="field">
                <label>Dia de pagamento (mês seguinte)</label>
                <input type="number" name="day" min="1" max="28" defaultValue={5} />
              </div>
            </div>
          </ActionForm>
        </div>
      </div>

      <form className="filters">
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
                <th>Nome</th>
                <th>Cargo</th>
                <th>Departamento</th>
                <th>Contato</th>
                <th>Acesso / Permissões</th>
                <th>Admissão</th>
                <th className="num">Salário</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const hasLogin = Boolean(e.user && e.user.active);
                const role = e.user?.role ?? "FUNCIONARIO";
                const perms = parsePermissions(e.user?.permissions ?? e.permissions, role);
                return (
                  <tr key={e.id}>
                    <td className="bold">
                      <Link href={`/funcionarios/${e.id}`}>{e.name}</Link>
                    </td>
                    <td>{e.position}</td>
                    <td>{e.department ?? "—"}</td>
                    <td>
                      <div>{e.email ?? "—"}</div>
                      <div className="muted small">{e.phone}</div>
                    </td>
                    <td>
                      {hasLogin ? (
                        <div>
                          <span className="badge green">
                            <KeyRound size={11} /> {role === "ADMIN" ? "Admin (Total)" : "Login Ativo"}
                          </span>
                          <div className="muted small" style={{ marginTop: 3 }}>
                            <Shield size={11} className="icon-inline" /> {perms.length} de {ALL_MODULE_KEYS.length}{" "}
                            módulos
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="badge gray">Sem login</span>
                          <div className="muted small" style={{ marginTop: 3 }}>
                            {perms.length} módulos pré-definidos
                          </div>
                        </div>
                      )}
                    </td>
                    <td>{fmtDate(e.hireDate)}</td>
                    <td className="num">{brl(e.salary)}</td>
                    <td>
                      <ActiveBadge active={e.active} />
                    </td>
                    <td className="actions">
                      <Link className="btn sm secondary" href={`/funcionarios/${e.id}`}>
                        Editar / Acessos
                      </Link>
                      <ConfirmButton
                        action={deleteEmployee.bind(null, e.id)}
                        label="Excluir"
                        className="btn sm danger"
                        confirmText={`Excluir o funcionário "${e.name}"?`}
                      />
                    </td>
                  </tr>
                );
              })}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty">
                    Nenhum funcionário encontrado.
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
