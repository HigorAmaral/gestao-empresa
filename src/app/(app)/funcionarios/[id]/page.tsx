import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { toInputDate, todayInput } from "@/lib/format";
import { parsePermissions } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/Forms";
import { PermissionsSelector } from "@/components/PermissionsSelector";
import { saveEmployee } from "../actions";

export default async function FuncionarioPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("funcionarios");
  const { id } = await params;
  const isNew = id === "novo";
  const employee = isNew
    ? null
    : await prisma.employee.findUnique({
        where: { id: Number(id) },
        include: { user: true },
      });
  if (!isNew && !employee) notFound();

  const departments = await prisma.employee.findMany({
    where: { department: { not: null } },
    distinct: ["department"],
    select: { department: true },
  });

  const currentRole = employee?.user?.role === "ADMIN" ? "ADMIN" : "FUNCIONARIO";
  const currentPermissions = parsePermissions(
    employee?.user?.permissions ?? employee?.permissions,
    currentRole,
  );
  const hasExistingUser = Boolean(employee?.user && employee.user.active);

  return (
    <>
      <PageHeader
        title={isNew ? "Novo funcionário" : employee!.name}
        subtitle={isNew ? "Cadastro de colaborador e permissões de acesso" : employee!.position}
      />
      <div className="card">
        <ActionForm
          action={saveEmployee.bind(null, employee?.id ?? null)}
          extraActions={
            <Link className="btn secondary" href="/funcionarios">
              Cancelar
            </Link>
          }
        >
          <div className="form-grid">
            <div className="field s8">
              <label>Nome completo *</label>
              <input name="name" defaultValue={employee?.name ?? ""} required />
            </div>
            <div className="field s4">
              <label>CPF</label>
              <input name="document" defaultValue={employee?.document ?? ""} />
            </div>
            <div className="field">
              <label>E-mail (usado para login no sistema)</label>
              <input name="email" type="email" defaultValue={employee?.email ?? employee?.user?.email ?? ""} />
            </div>
            <div className="field">
              <label>Telefone</label>
              <input name="phone" defaultValue={employee?.phone ?? ""} />
            </div>
            <div className="field s4">
              <label>Cargo *</label>
              <input name="position" defaultValue={employee?.position ?? ""} required />
            </div>
            <div className="field s4">
              <label>Departamento</label>
              <input name="department" list="departments" defaultValue={employee?.department ?? ""} />
              <datalist id="departments">
                {departments.map((d) => (
                  <option key={d.department} value={d.department!} />
                ))}
              </datalist>
            </div>
            <div className="field s2">
              <label>Salário (R$)</label>
              <input name="salary" type="number" step="0.01" min="0" defaultValue={employee?.salary ?? 0} />
            </div>
            <div className="field s2">
              <label>Admissão *</label>
              <input
                name="hireDate"
                type="date"
                defaultValue={employee ? toInputDate(employee.hireDate) : todayInput()}
                required
              />
            </div>
            <div className="field s12">
              <label>Observações</label>
              <textarea name="notes" defaultValue={employee?.notes ?? ""} />
            </div>
            <div className="field s12">
              <label className="checkbox">
                <input type="checkbox" name="active" defaultChecked={employee?.active ?? true} /> Funcionário ativo
              </label>
            </div>

            <PermissionsSelector
              mode="employee"
              defaultPermissions={currentPermissions}
              defaultRole={currentRole}
              hasExistingUser={hasExistingUser}
            />
          </div>
        </ActionForm>
      </div>
    </>
  );
}
