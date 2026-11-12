import { AlertTriangle, Calendar, CheckCircle2, Clock, Palmtree, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { spStr } from "@/lib/form";
import { brl, fmtDate, todayInput } from "@/lib/format";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { FlashMessages, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/Forms";
import { RhSubnav } from "../RhSubnav";
import {
  createEmployeeLeaveAction,
  deleteEmployeeLeaveAction,
  quickGrantVacationAction,
} from "../actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function FeriasAtestadosPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin("funcionarios");
  await ensureStockLocationTables();

  const sp = await searchParams;
  const refMonth = spStr(sp, "month") || todayInput().slice(0, 7);

  const [allActiveEmployees, leaves] = await Promise.all([
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.employeeLeave.findMany({
      include: { employee: true },
      orderBy: { startDate: "desc" },
      take: 60,
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Férias, Atestados Médicos & Licenças"
        subtitle="Cálculo automático de período aquisitivo/concessivo CLT, recibo de férias com 1/3 Constitucional integrado ao Financeiro e atestados com CID"
      />
      <FlashMessages sp={sp} />

      <RhSubnav active="ferias" refMonth={refMonth} basePath="/funcionarios/ferias" />

      {/* Painel Automático de Período Aquisitivo e Concessivo com Botões 1-Clique (Largura Total) */}
      <div className="card flush mb">
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={18} /> Ciclo de Férias por Colaborador (Automação 1-Clique)
          </h2>
          <div className="small muted">
            Clique em <strong>&quot;Conceder 30d&quot;</strong> ou <strong>&quot;15d&quot;</strong> para calcular automaticamente o Salário de Férias + 1/3 Constitucional e lançar no Financeiro.
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Admissão / Tempo</th>
                <th>Status do Período</th>
                <th className="num">Valor 30d + 1/3</th>
                <th>Concessão Automática</th>
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
                const est30dValue = Math.round(emp.salary * 1.3333 * 100) / 100;

                let badgeClass = "blue";
                let statusText = `Em Aquisição (${cycleMonths}/12 avos)`;
                let statusIcon = <Clock size={12} />;
                if (monthsWorked >= 22) {
                  badgeClass = "red";
                  statusText = "Vencendo Limite Concessivo";
                  statusIcon = <AlertTriangle size={12} />;
                } else if (completedYears >= 1) {
                  badgeClass = "yellow";
                  statusText = `Direito Adquirido (${completedYears}º ciclo)`;
                  statusIcon = <CheckCircle2 size={12} />;
                }

                return (
                  <tr key={emp.id}>
                    <td className="bold">{emp.name}</td>
                    <td>
                      <div>{fmtDate(emp.hireDate)}</div>
                      <div className="small muted">{monthsWorked} meses</div>
                    </td>
                    <td>
                      <span className={`badge ${badgeClass}`}>
                        {statusIcon}
                        <span>{statusText}</span>
                      </span>
                    </td>
                    <td className="num bold">{brl(est30dValue)}</td>
                    <td className="actions">
                      <ConfirmButton
                        action={quickGrantVacationAction.bind(null, emp.id, 30)}
                        className="btn sm"
                        confirmText={`Conceder 30 dias de Férias Regulamentares para ${emp.name}? O valor de ${brl(est30dValue)} (Salário + 1/3 Constitucional) será calculado e lançado automaticamente no Financeiro.`}
                      >
                        <Palmtree size={13} /> 30d Férias
                      </ConfirmButton>
                      <ConfirmButton
                        action={quickGrantVacationAction.bind(null, emp.id, 15)}
                        className="btn sm secondary"
                        confirmText={`Conceder 15 dias de Férias Proporcionais para ${emp.name} (${brl(est30dValue / 2)})?`}
                      >
                        15d
                      </ConfirmButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Formulário Simplificado com Cálculo Automático */}
      <div className="card mb">
        <h2 className="mb" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Calendar size={18} /> Registrar Atestado Médico, Licença ou Férias Customizadas
        </h2>
        <p className="small muted mb">
          Basta informar a data de início e a quantidade de dias: o sistema calcula a data de retorno e o adicional de 1/3 automaticamente!
        </p>
        <form action={createEmployeeLeaveAction}>
          <div className="form-grid">
            <div className="field s4">
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
            <div className="field s4">
              <label>Tipo de Registro *</label>
              <select name="type" defaultValue="ATESTADO_MEDICO">
                <option value="ATESTADO_MEDICO">Atestado Médico Abonado (Sem Desconto)</option>
                <option value="FERIAS">Férias Regulamentares (Cálculo Automático +1/3)</option>
                <option value="LICENCA">Licença Maternidade / Paternidade / Casamento</option>
                <option value="AFASTAMENTO_INSS">Afastamento Previdenciário INSS (&gt;15 dias)</option>
              </select>
            </div>
            <div className="field s2">
              <label>Data de Início *</label>
              <input type="date" name="startDate" defaultValue={todayInput()} required />
            </div>
            <div className="field s2">
              <label>Qtd. de Dias *</label>
              <input type="number" name="days" min="1" max="180" defaultValue={2} required />
            </div>
            <div className="field s3">
              <label>Código CID (Opcional p/ Atestado)</label>
              <input name="cidCode" placeholder="Ex: J06.9, M54" />
            </div>
            <div className="field s4">
              <label>Médico / CRM (Opcional)</label>
              <input name="doctorName" placeholder="Ex: Dr. Marcos CRM 148920" />
            </div>
            <div className="field s5">
              <label>Observações</label>
              <input name="notes" placeholder="Opcional" />
            </div>
            <div className="field s12">
              <button type="submit" className="btn">
                <Plus size={15} /> Salvar Registro Automático
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Histórico */}
      <div className="card flush">
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
          <strong>Histórico de Férias Concedidas, Atestados Médicos e Licenças ({leaves.length})</strong>
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
                <th className="num">Valor Férias (+1/3)</th>
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
                  <td className="num bold">{(lv.vacationPay ?? 0) > 0 ? brl(lv.vacationPay!) : "—"}</td>
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
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
