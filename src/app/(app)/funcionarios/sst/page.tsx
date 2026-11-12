import { AlertTriangle, HeartPulse, Plus, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { spStr } from "@/lib/form";
import { fmtDate, todayInput } from "@/lib/format";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { FlashMessages, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/Forms";
import { RhSubnav } from "../RhSubnav";
import {
  createSafetyRecordAction,
  deleteSafetyRecordAction,
  quickIssueSstKitAction,
} from "../actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function SegurancaTrabalhoSstPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin("funcionarios");
  await ensureStockLocationTables();

  const sp = await searchParams;
  const refMonth = spStr(sp, "month") || todayInput().slice(0, 7);

  const [allActiveEmployees, safetyRecords] = await Promise.all([
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.employeeSafetyRecord.findMany({
      include: { employee: true },
      orderBy: { issuedAt: "desc" },
      take: 80,
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Segurança do Trabalho (SST) — EPIs & Exames ASO"
        subtitle="Emissão em 1 clique de Kit EPI com Certificado de Aprovação (CA) e Exames Ocupacionais ASO com validade automática de 12 meses"
      />
      <FlashMessages sp={sp} />

      <RhSubnav active="sst" refMonth={refMonth} basePath="/funcionarios/sst" />

      <div className="grid grid-2 mb">
        {/* Emissão Rápida em 1 Clique por Colaborador */}
        <div className="card flush">
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <ShieldCheck size={18} /> Ações Rápidas SST por Colaborador (1 Clique)
            </h2>
            <div className="small muted">
              Registra automaticamente a entrega do Kit EPI Padrão (CA 42189) ou renova o Exame ASO Periódico com vencimento automático para 1 ano.
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Colaborador / Cargo</th>
                  <th>Setor</th>
                  <th>Emissão Automática (Validade +1 Ano)</th>
                </tr>
              </thead>
              <tbody>
                {allActiveEmployees.map((emp) => (
                  <tr key={emp.id}>
                    <td>
                      <div className="bold">{emp.name}</div>
                      <div className="small muted">{emp.position}</div>
                    </td>
                    <td>{emp.department || "Geral"}</td>
                    <td className="actions">
                      <ConfirmButton
                        action={quickIssueSstKitAction.bind(null, emp.id, "EPI")}
                        label="🦺 Entregar Kit EPI"
                        className="btn sm"
                        confirmText={`Registrar entrega de Kit EPI Padrão (CA 42189) com validade de 1 ano para ${emp.name}?`}
                      />
                      <ConfirmButton
                        action={quickIssueSstKitAction.bind(null, emp.id, "ASO")}
                        label="🩺 Renovar ASO"
                        className="btn sm secondary"
                        confirmText={`Registrar Exame Ocupacional ASO Periódico (APTO) com validade de 1 ano para ${emp.name}?`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Registro Customizado */}
        <div className="card">
          <h2 className="mb" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <HeartPulse size={18} /> Registrar EPI Específico ou Exame Ocupacional
          </h2>
          <p className="small muted mb">
            Se não informar a data de validade, o sistema calcula automaticamente <strong>+12 meses</strong> a partir da data de entrega.
          </p>
          <form action={createSafetyRecordAction}>
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
                <label>Categoria SST *</label>
                <select name="recordType" defaultValue="EPI">
                  <option value="EPI">🦺 Entrega de EPI (NR-06)</option>
                  <option value="ASO_ADMISSIONAL">🩺 ASO — Exame Admissional</option>
                  <option value="ASO_PERIODICO">🩺 ASO — Exame Periódico Anual</option>
                  <option value="ASO_DEMISSIONAL">🩺 ASO — Exame Demissional</option>
                </select>
              </div>
              <div className="field s8">
                <label>Descrição do EPI ou Exame *</label>
                <input name="itemName" placeholder="Ex: Luva Nitrílica / Botina de Segurança" required />
              </div>
              <div className="field s4">
                <label>Nº CA / Resultado</label>
                <input name="caNumber" placeholder="Ex: 42189 ou APTO" />
              </div>
              <div className="field s6">
                <label>Data de Entrega / Exame</label>
                <input type="date" name="deliveryDate" defaultValue={todayInput()} />
              </div>
              <div className="field s6">
                <label>Vencimento (Vazio = +1 ano automático)</label>
                <input type="date" name="expiryDate" />
              </div>
              <div className="field s12">
                <button type="submit" className="btn">
                  <Plus size={15} /> Registrar na Ficha SST
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Fichas de EPI e Exames ASO Vigentes */}
      <div className="card flush">
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
          <strong>Fichas de EPIs Entregues (NR-06) e Exames Ocupacionais ASO (NR-07) ({safetyRecords.length})</strong>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Tipo</th>
                <th>EPI / Exame Ocupacional</th>
                <th>CA / Parecer</th>
                <th>Emissão</th>
                <th>Validade / Renovação</th>
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
                    <td>
                      <div className="bold">{rec.title}</div>
                      {rec.notes && <div className="small muted">{rec.notes}</div>}
                    </td>
                    <td>
                      <span className="mono badge gray">{rec.caNumber || "APTO"}</span>
                    </td>
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
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
