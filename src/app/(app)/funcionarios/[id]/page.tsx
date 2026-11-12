import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { toInputDate, todayInput } from "@/lib/format";
import { parsePermissions } from "@/lib/permissions";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/Forms";
import { PermissionsSelector } from "@/components/PermissionsSelector";
import { saveEmployee } from "../actions";

export default async function FuncionarioPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("funcionarios");
  await ensureStockLocationTables();

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
        title={isNew ? "Novo Colaborador (Prontuário RH)" : employee!.name}
        subtitle={
          isNew
            ? "Ficha cadastral completa, documentos trabalhistas (PIS/CTPS), benefícios, jornada para Relógio de Ponto (REP) e acessos"
            : `${employee!.position} · Regime ${employee!.contractType || "CLT"}`
        }
        actions={
          !isNew && employee ? (
            <Link className="btn secondary" href={`/funcionarios/${employee.id}/recibo`}>
              <Printer size={15} /> Emitir Holerite Oficial
            </Link>
          ) : undefined
        }
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
            <div className="field s12">
              <h3 style={{ margin: "0 0 4px 0" }}>1. Dados Pessoais & Documentos Trabalhistas</h3>
              <div className="small muted">
                O número do <strong>PIS/PASEP</strong> ou <strong>CPF</strong> é utilizado para vincular automaticamente as batidas vindas da máquina física de Relógio de Ponto (REP).
              </div>
            </div>

            <div className="field s6">
              <label>Nome completo *</label>
              <input name="name" defaultValue={employee?.name ?? ""} required />
            </div>
            <div className="field s3">
              <label>CPF</label>
              <input name="document" placeholder="000.000.000-00" defaultValue={employee?.document ?? ""} />
            </div>
            <div className="field s3">
              <label>RG / Órgão Emissor</label>
              <input name="rg" placeholder="Ex: 12.345.678-9 SSP" defaultValue={employee?.rg ?? ""} />
            </div>

            <div className="field s3">
              <label>PIS / PASEP / NIS (Chave do Relógio REP)</label>
              <input name="pis" placeholder="11 dígitos (Ex: 12345678901)" defaultValue={employee?.pis ?? ""} />
            </div>
            <div className="field s3">
              <label>CTPS (Nº / Série / UF)</label>
              <input name="ctps" placeholder="Carteira Digital ou Física" defaultValue={employee?.ctps ?? ""} />
            </div>
            <div className="field s3">
              <label>Data de Nascimento</label>
              <input
                name="birthDate"
                type="date"
                defaultValue={employee?.birthDate ? toInputDate(employee.birthDate) : ""}
              />
            </div>
            <div className="field s3">
              <label>Nº de Dependentes (Para dedução IRRF)</label>
              <input
                name="dependentsCount"
                type="number"
                min="0"
                max="20"
                defaultValue={employee?.dependentsCount ?? 0}
              />
            </div>

            <div className="field s4">
              <label>E-mail (usado para login no sistema)</label>
              <input name="email" type="email" defaultValue={employee?.email ?? employee?.user?.email ?? ""} />
            </div>
            <div className="field s4">
              <label>Telefone / WhatsApp</label>
              <input name="phone" defaultValue={employee?.phone ?? ""} />
            </div>
            <div className="field s4">
              <label>Contato de Emergência (Nome e Telefone)</label>
              <input
                name="emergencyContact"
                placeholder="Ex: Maria (Esposa) - (11) 99999-0000"
                defaultValue={employee?.emergencyContact ?? ""}
              />
            </div>

            <div className="field s12" style={{ marginTop: 10 }}>
              <h3 style={{ margin: "0 0 4px 0" }}>2. Contrato de Trabalho, Cargo & Jornada (Relógio de Ponto)</h3>
            </div>

            <div className="field s3">
              <label>Regime de Contratação *</label>
              <select name="contractType" defaultValue={employee?.contractType ?? "CLT"}>
                <option value="CLT">CLT (Com INSS, FGTS 8%, Férias e 13º)</option>
                <option value="PJ">Prestador PJ (Sem retenção CLT)</option>
                <option value="ESTAGIO">Estágio (Bolsa-Auxílio Lei 11.788)</option>
                <option value="TEMPORARIO">Contrato Temporário</option>
              </select>
            </div>
            <div className="field s3">
              <label>Cargo / Função *</label>
              <input name="position" defaultValue={employee?.position ?? ""} required />
            </div>
            <div className="field s3">
              <label>Departamento / Setor</label>
              <input name="department" list="departments" defaultValue={employee?.department ?? ""} />
              <datalist id="departments">
                {departments.map((d) => (
                  <option key={d.department} value={d.department!} />
                ))}
              </datalist>
            </div>
            <div className="field s3">
              <label>Data de Admissão *</label>
              <input
                name="hireDate"
                type="date"
                defaultValue={employee ? toInputDate(employee.hireDate) : todayInput()}
                required
              />
            </div>

            <div className="field s3">
              <label>Salário Base Mensal (R$) *</label>
              <input name="salary" type="number" step="0.01" min="0" defaultValue={employee?.salary ?? 0} />
            </div>
            <div className="field s3">
              <label>Carga Horária Diária (Horas/dia)</label>
              <input
                name="workHoursPerDay"
                type="number"
                step="0.5"
                min="1"
                max="12"
                defaultValue={employee?.workHoursPerDay ?? 8}
              />
            </div>
            <div className="field s6">
              <label>Escala / Horário Contratual (Usado no Espelho de Ponto)</label>
              <input
                name="workSchedule"
                placeholder="Ex: Seg a Sex 08:00 às 12:00 / 13:00 às 17:00"
                defaultValue={employee?.workSchedule ?? "08:00 às 12:00 / 13:00 às 17:00"}
              />
            </div>

            <div className="field s12" style={{ marginTop: 10 }}>
              <h3 style={{ margin: "0 0 4px 0" }}>3. Benefícios, Adicionais & Dados Bancários para Pagamento</h3>
            </div>

            <div className="field s3">
              <label>Vale-Refeição / Alimentação Mensal (R$)</label>
              <input name="vrAmount" type="number" step="0.01" min="0" defaultValue={employee?.vrAmount ?? 0} />
            </div>
            <div className="field s3">
              <label>Vale-Transporte Diário (R$)</label>
              <input name="vtDaily" type="number" step="0.01" min="0" defaultValue={employee?.vtDaily ?? 0} />
            </div>
            <div className="field s3">
              <label>Plano de Saúde / Odonto (Desconto R$)</label>
              <input
                name="healthPlanDeduction"
                type="number"
                step="0.01"
                min="0"
                defaultValue={employee?.healthPlanDeduction ?? 0}
              />
            </div>
            <div className="field s3">
              <label>Adicional Insalubridade / Periculosidade (%)</label>
              <select name="hazardAdditionPct" defaultValue={String(employee?.hazardAdditionPct ?? 0)}>
                <option value="0">0% — Sem adicional</option>
                <option value="10">10% — Insalubridade Grau Mínimo</option>
                <option value="20">20% — Insalubridade Grau Médio</option>
                <option value="30">30% — Periculosidade (30% Salário Base)</option>
                <option value="40">40% — Insalubridade Grau Máximo</option>
              </select>
            </div>

            <div className="field s6">
              <label>Banco / Agência / Conta Corrente</label>
              <input
                name="bankInfo"
                placeholder="Ex: Banco Itaú (341) · Ag 0001 · CC 12345-6"
                defaultValue={employee?.bankInfo ?? ""}
              />
            </div>
            <div className="field s6">
              <label>Chave PIX do Colaborador (Para pagamento da folha)</label>
              <input name="pixKey" placeholder="CPF, E-mail, Celular ou Aleatória" defaultValue={employee?.pixKey ?? ""} />
            </div>

            <div className="field s12">
              <label className="checkbox">
                <input type="checkbox" name="vtOptIn" defaultChecked={employee?.vtOptIn ?? false} /> Optante pelo Vale-Transporte (aplica desconto legal de até 6% do salário base no Holerite)
              </label>
            </div>

            <div className="field s12">
              <label>Observações de Prontuário</label>
              <textarea name="notes" defaultValue={employee?.notes ?? ""} />
            </div>
            <div className="field s12">
              <label className="checkbox">
                <input type="checkbox" name="active" defaultChecked={employee?.active ?? true} /> Colaborador ativo na empresa
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
