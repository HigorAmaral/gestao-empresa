import {
  CheckCircle2,
  Cpu,
  Plus,
  RefreshCw,
  Upload,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { spStr } from "@/lib/form";
import { brl, fmtDate, todayInput } from "@/lib/format";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { FlashMessages, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/Forms";
import { RhSubnav } from "../RhSubnav";
import {
  createTimeClockMachineAction,
  deleteTimeClockMachineAction,
  importAfdFileAction,
  syncRepMachineNowAction,
  transferRepToPayrollAction,
} from "../actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

function fmtMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return `${h}h${String(rem).padStart(2, "0")}m`;
}

export default async function RelogioPontoRepPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin("funcionarios");
  await ensureStockLocationTables();

  const sp = await searchParams;
  const refMonth = spStr(sp, "month") || todayInput().slice(0, 7);
  const [ry, rm] = refMonth.split("-").map(Number);
  const startOfMonth = new Date(Date.UTC(ry, rm - 1, 1, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(ry, rm, 0, 23, 59, 59));

  const [employees, machines, clockLogs] = await Promise.all([
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.timeClockMachine.findMany({ orderBy: { id: "asc" } }),
    prisma.timeClockLog.findMany({
      where: { date: { gte: startOfMonth, lte: endOfMonth } },
      include: { employee: true, machine: true },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: 150,
    }),
  ]);

  const totalOvertimeMinMonth = clockLogs.reduce((s, l) => s + (l.overtimeMinutes || 0), 0);
  const totalLateMinMonth = clockLogs.reduce((s, l) => s + (l.lateMinutes || 0), 0);

  return (
    <>
      <PageHeader
        title="Relógio de Ponto Eletrônico (REP) & Espelho"
        subtitle="Sincronização automática com máquinas físicas de bater ponto (Control iD, Henry, Topdata, Dimep) e integração com a Folha"
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <form action={syncRepMachineNowAction}>
              <input type="hidden" name="month" value={refMonth} />
              <button type="submit" className="btn secondary">
                <RefreshCw size={15} /> Sincronizar Máquina REP Agora
              </button>
            </form>
            <form action={transferRepToPayrollAction}>
              <input type="hidden" name="month" value={refMonth} />
              <button type="submit" className="btn">
                <CheckCircle2 size={15} /> Enviar Horas Extras / Atrasos para Folha ({refMonth})
              </button>
            </form>
          </div>
        }
      />
      <FlashMessages sp={sp} />

      <RhSubnav active="ponto" refMonth={refMonth} basePath="/funcionarios/ponto" />

      <div className="stats">
        <div className="stat primary">
          <div className="label">Máquinas REP Conectadas</div>
          <div className="value">{machines.length}</div>
          <div className="hint">Sincronização Automática Ativa</div>
        </div>
        <div className="stat">
          <div className="label">Registros Recebidos ({refMonth})</div>
          <div className="value">{clockLogs.length} dias</div>
          <div className="hint">batidas biométricas / faciais</div>
        </div>
        <div className="stat">
          <div className="label">Saldo Horas Extras (+50%)</div>
          <div className="value" style={{ color: "var(--success, #22c55e)" }}>
            +{fmtMinutes(totalOvertimeMinMonth)}
          </div>
          <div className="hint">integrado automaticamente à folha</div>
        </div>
        <div className="stat warn">
          <div className="label">Atrasos / Faltas ({refMonth})</div>
          <div className="value">{fmtMinutes(totalLateMinMonth)}</div>
          <div className="hint">tolerância CLT: 10 min/dia</div>
        </div>
      </div>

      {/* Resumo Consolidado por Colaborador no Mês */}
      <div className="card flush mb">
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>Resumo Mensal do Ponto por Colaborador — Competência {refMonth}</strong>
          <span className="badge green">Integrado à Folha de Pagamento</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Colaborador / PIS</th>
                <th className="num">Dias Batidos</th>
                <th className="num">Total Horas Trabalhadas</th>
                <th className="num">Horas Extras (+50%)</th>
                <th className="num">Valor Hora Extra (R$)</th>
                <th className="num">Atrasos</th>
                <th>Status na Folha</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const empLogs = clockLogs.filter((l) => l.employeeId === emp.id);
                const workedMin = empLogs.reduce((s, l) => s + (l.workedMinutes || 0), 0);
                const otMin = empLogs.reduce((s, l) => s + (l.overtimeMinutes || 0), 0);
                const lateMin = empLogs.reduce((s, l) => s + (l.lateMinutes || 0), 0);
                const hourlyRate = emp.salary / 220;
                const otValue = Math.round((otMin / 60) * hourlyRate * 1.5 * 100) / 100;

                return (
                  <tr key={emp.id}>
                    <td>
                      <div className="bold">{emp.name}</div>
                      <div className="small muted">PIS: {emp.pis || "—"}</div>
                    </td>
                    <td className="num">{empLogs.length} dias</td>
                    <td className="num bold">{fmtMinutes(workedMin)}</td>
                    <td className="num">
                      {otMin > 0 ? <span className="badge green">+{fmtMinutes(otMin)}</span> : "—"}
                    </td>
                    <td className="num bold" style={{ color: otValue > 0 ? "var(--success, #22c55e)" : undefined }}>
                      {otValue > 0 ? `+${brl(otValue)}` : "R$ 0,00"}
                    </td>
                    <td className="num">
                      {lateMin > 0 ? <span className="badge red">-{fmtMinutes(lateMin)}</span> : "0h00m"}
                    </td>
                    <td>
                      <span className="badge blue">Sincronizado c/ Holerite</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Máquinas Físicas de Ponto Configuradas + Opções Avançadas Recolhíveis */}
      <div className="card flush mb">
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Cpu size={17} /> Equipamentos de Relógio de Ponto Físico (REP-C / REP-P)
          </strong>
          <span className="small muted">Endpoint Push Tempo Real: POST /api/rep/sync</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Relógio / Local</th>
                <th>Fabricante & Modelo</th>
                <th>Rede (IP : Porta)</th>
                <th>Token Webhook (Push Automático)</th>
                <th>Última Sincronização</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {machines.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="bold">{m.name}</div>
                    <div className="small muted">{m.location || "Portaria"}</div>
                  </td>
                  <td>
                    <span className="badge blue">{m.brand}</span>{" "}
                    <span className="small muted">{m.model || "Biométrico"}</span>
                  </td>
                  <td className="mono small">
                    {m.ipAddress || "192.168.1.201"}:{m.port || 443}
                  </td>
                  <td className="mono small">{m.apiToken}</td>
                  <td>
                    <span className="badge green">Online</span>{" "}
                    <span className="small muted">
                      {m.lastSyncAt ? new Date(m.lastSyncAt).toLocaleDateString("pt-BR") : "Ativo"} ({m.totalSynced} batidas)
                    </span>
                  </td>
                  <td className="actions">
                    <form action={syncRepMachineNowAction} style={{ display: "inline" }}>
                      <input type="hidden" name="machineId" value={m.id} />
                      <input type="hidden" name="month" value={refMonth} />
                      <button type="submit" className="btn sm">
                        <RefreshCw size={13} /> Sincronizar
                      </button>
                    </form>
                    {machines.length > 1 && (
                      <ConfirmButton
                        action={deleteTimeClockMachineAction.bind(null, m.id)}
                        label="Remover"
                        className="btn sm danger"
                        confirmText={`Remover o relógio "${m.name}"?`}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Opções Avançadas Recolhidas para manter a tela limpa */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 16, flexWrap: "wrap" }}>
          <details style={{ flex: "1 1 380px" }}>
            <summary className="btn sm secondary" style={{ cursor: "pointer", display: "inline-flex" }}>
              <Plus size={14} /> Adicionar Nova Máquina de Ponto (REP)
            </summary>
            <form action={createTimeClockMachineAction} style={{ marginTop: 12 }}>
              <div className="form-grid">
                <div className="field s6">
                  <label>Nome do Relógio *</label>
                  <input name="name" placeholder="Ex: Relógio Galpão Produção" required />
                </div>
                <div className="field s6">
                  <label>Fabricante *</label>
                  <select name="brand" defaultValue="CONTROL_ID">
                    <option value="CONTROL_ID">Control iD (iDClass / iDFace)</option>
                    <option value="HENRY">Henry (Prisma / Hexa)</option>
                    <option value="TOPDATA">Topdata (Inner Rep)</option>
                    <option value="DIMEP">Dimep (PrintPoint)</option>
                    <option value="INTELBRAS">Intelbras</option>
                  </select>
                </div>
                <div className="field s4">
                  <label>Modelo</label>
                  <input name="model" placeholder="iDClass Bio 671" />
                </div>
                <div className="field s4">
                  <label>IP na Rede</label>
                  <input name="ipAddress" placeholder="192.168.1.202" />
                </div>
                <div className="field s4">
                  <label>Local</label>
                  <input name="location" placeholder="Portaria 2" />
                </div>
                <div className="field s12">
                  <button type="submit" className="btn sm">
                    Salvar Relógio
                  </button>
                </div>
              </div>
            </form>
          </details>

          <details style={{ flex: "1 1 380px" }}>
            <summary className="btn sm secondary" style={{ cursor: "pointer", display: "inline-flex" }}>
              <Upload size={14} /> Importar Arquivo AFD via Pen-Drive (.txt / .afd)
            </summary>
            <form action={importAfdFileAction} style={{ marginTop: 12 }}>
              <input type="hidden" name="month" value={refMonth} />
              <div className="form-grid">
                <div className="field s12">
                  <label>Cole as linhas do arquivo AFD (Portaria 1510/671) ou CSV (`PIS;AAAA-MM-DD;08:00;12:00;13:00;17:00`)</label>
                  <textarea
                    name="afdContent"
                    rows={3}
                    placeholder="20455121709;2026-11-12;08:00;12:00;13:00;18:00"
                    required
                  />
                </div>
                <div className="field s12">
                  <button type="submit" className="btn sm">
                    Processar Arquivo AFD
                  </button>
                </div>
              </div>
            </form>
          </details>
        </div>
      </div>

      {/* Espelho de Batidas Diárias */}
      <div className="card flush">
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
          <strong>Espelho Diário de Marcações Recebidas da Máquina — {refMonth}</strong>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Colaborador</th>
                <th>Relógio / NSR</th>
                <th>Entrada 1</th>
                <th>Saída Almoço</th>
                <th>Retorno Almoço</th>
                <th>Saída 2</th>
                <th className="num">Trabalhado</th>
                <th className="num">Hora Extra (+50%)</th>
                <th className="num">Atraso</th>
              </tr>
            </thead>
            <tbody>
              {clockLogs.map((log) => (
                <tr key={log.id}>
                  <td className="mono bold">{fmtDate(log.date)}</td>
                  <td className="bold">{log.employee.name}</td>
                  <td>
                    <span className="small">{log.machine?.name || log.source}</span>
                    {log.nsr && <span className="mono small muted"> · NSR #{log.nsr}</span>}
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
                      "—"
                    )}
                  </td>
                  <td className="num">
                    {log.lateMinutes > 0 ? (
                      <span className="badge red">-{fmtMinutes(log.lateMinutes)}</span>
                    ) : (
                      "—"
                    )}
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
