import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  HeartPulse,
  Palmtree,
  Printer,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  Zap,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { brl, fmtDate, todayInput } from "@/lib/format";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { FlashMessages, PageHeader } from "@/components/ui";
import { requestVacationAction } from "./actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function PortalColaboradorPage({ searchParams }: { searchParams: SP }) {
  await ensureStockLocationTables();
  const session = await requireUser();
  const sp = await searchParams;

  // Busca ESTRITAMENTE o colaborador vinculado ao usuário logado (privacidade e proteção LGPD)
  const employee = await prisma.employee.findFirst({
    where: {
      active: true,
      OR: [
        { userId: session.userId },
        { email: session.email },
      ],
    },
    include: {
      leaves: { orderBy: { startDate: "desc" }, take: 15 },
      safetyRecords: { orderBy: { issuedAt: "desc" }, take: 15 },
      timeClockLogs: { orderBy: { date: "desc" }, take: 20 },
    },
  });

  const now = new Date();

  // Gera lista dos últimos 6 meses para download de holerite
  const recentMonths: { key: string; label: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    recentMonths.push({ key, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }

  // Se o usuário logado não possui ficha de funcionário vinculada
  if (!employee) {
    return (
      <>
        <PageHeader
          title="Portal do Colaborador"
          subtitle="Área individual de autoatendimento e consulta de holerites para a equipe"
        />
        <FlashMessages sp={sp} />

        <div className="card text-center" style={{ padding: 48, maxWidth: 640, margin: "20px auto" }}>
          <UserCheck size={44} style={{ margin: "0 auto 14px", opacity: 0.4 }} />
          <h3 style={{ marginBottom: 8, fontSize: 18 }}>Nenhuma ficha de colaborador vinculada ao seu usuário</h3>
          <p className="muted" style={{ lineHeight: 1.6, fontSize: 13.5 }}>
            Você está conectado como <strong>{session.name}</strong> ({session.email}).<br />
            Por segurança e sigilo de dados da equipe (LGPD), cada colaborador só pode visualizar exclusivamente as suas próprias informações salariais, recibos e ponto.
          </p>

          {session.role === "ADMIN" && (
            <div
              style={{
                marginTop: 24,
                padding: 16,
                background: "var(--surface-subtle)",
                borderRadius: 8,
                border: "1px solid var(--border)",
                textAlign: "left",
                fontSize: 13,
              }}
            >
              <strong style={{ display: "block", marginBottom: 6 }}>Instrução para o Administrador:</strong>
              <p className="muted" style={{ margin: "0 0 12px 0", lineHeight: 1.5 }}>
                Para visualizar seus próprios holerites aqui no portal, vincule seu usuário de login à sua ficha de colaborador no RH.
              </p>
              <Link href="/funcionarios" className="btn sm">
                Ir para Cadastro de Equipe & Prontuários
              </Link>
            </div>
          )}
        </div>
      </>
    );
  }

  // Cálculo de período de férias estritamente deste colaborador
  const hire = employee.hireDate ? new Date(employee.hireDate) : new Date();
  const monthsWorked = Math.max(
    0,
    (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth())
  );
  const cycleMonths = Number.isFinite(monthsWorked) ? monthsWorked % 12 : 0;
  const completedYears = Number.isFinite(monthsWorked) ? Math.floor(monthsWorked / 12) : 0;

  return (
    <>
      <PageHeader
        title={`Portal do Colaborador — ${employee.name}`}
        subtitle="Área individual de autoatendimento: consulte seus holerites, espelho de ponto, férias e segurança do trabalho."
      />
      <FlashMessages sp={sp} />

      {/* Cartão de Identificação do Próprio Colaborador */}
      <div className="card mb">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h2 style={{ margin: "0 0 4px 0", fontSize: 18 }}>{employee.name}</h2>
            <div className="small muted">
              {employee.position} · {employee.department || "Geral"} ·{" "}
              <span className="badge blue">{employee.contractType || "CLT"}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 16, fontSize: 13, flexWrap: "wrap" }}>
            <div>
              <span className="muted block small">Data de Admissão</span>
              <strong>{fmtDate(employee.hireDate)}</strong> ({monthsWorked} meses)
            </div>
            <div>
              <span className="muted block small">Salário Base</span>
              <strong>{brl(employee.salary)}</strong>
            </div>
            <div>
              <span className="muted block small">Jornada Diária</span>
              <strong>{employee.workHoursPerDay || 8}h / dia</strong>
            </div>
            {employee.pis && (
              <div>
                <span className="muted block small">PIS / PASEP</span>
                <strong>{employee.pis}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        {/* Meus Holerites Oficiais */}
        <div className="card flush">
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
            <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <FileText size={16} /> Meus Holerites & Recibos de Pagamento
            </h3>
            <div className="small muted">Acesse e faça o download dos seus contracheques oficiais</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Competência</th>
                  <th className="actions">Visualizar / Imprimir</th>
                </tr>
              </thead>
              <tbody>
                {recentMonths.map((m) => (
                  <tr key={m.key}>
                    <td className="bold">{m.label}</td>
                    <td className="actions">
                      <Link
                        href={`/funcionarios/${employee.id}/recibo?mes=${m.key}`}
                        className="btn sm"
                        target="_blank"
                      >
                        <Printer size={13} /> Ver Holerite Oficial
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Minhas Férias & Solicitação com Antecedência */}
        <div className="card flush">
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
            <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <Palmtree size={16} /> Férias & Afastamentos
            </h3>
            <div className="small muted">
              Período Aquisitivo: <strong>{cycleMonths}/12 avos</strong> · Direito:{" "}
              <strong>{completedYears >= 1 ? `${completedYears * 30} dias adquiridos` : "Em aquisição"}</strong>
            </div>
          </div>

          <div style={{ padding: 16 }}>
            <h4 style={{ margin: "0 0 10px 0", fontSize: 13 }}>Solicitar Férias com Antecedência</h4>
            <form action={requestVacationAction}>
              <div className="form-grid mb">
                <div className="field s6">
                  <label>Data Pretendida de Início *</label>
                  <input type="date" name="startDate" defaultValue={todayInput()} required />
                </div>
                <div className="field s6">
                  <label>Quantidade de Dias *</label>
                  <select name="days" defaultValue="30">
                    <option value="30">30 dias corridos</option>
                    <option value="20">20 dias</option>
                    <option value="15">15 dias (1ª parcela)</option>
                    <option value="10">10 dias</option>
                  </select>
                </div>
                <div className="field s12">
                  <label>Mensagem / Observação para o RH</label>
                  <input name="notes" placeholder="Ex: Programação combinada com a gerência para o recesso" />
                </div>
              </div>
              <button type="submit" className="btn sm" style={{ width: "100%", justifyContent: "center" }}>
                <Palmtree size={14} /> Enviar Solicitação de Férias ao RH
              </button>
            </form>

            {/* Histórico recente */}
            <div style={{ marginTop: 16 }}>
              <strong style={{ fontSize: 12, display: "block", marginBottom: 6 }}>Histórico dos Meus Afastamentos / Férias:</strong>
              {employee.leaves.map((l) => (
                <div
                  key={l.id}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 6,
                    background: "var(--surface-subtle)",
                    fontSize: 12,
                    marginBottom: 6,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <strong>{l.type === "FERIAS" ? "Férias" : l.type}</strong> — {l.days} dias (a partir de {fmtDate(l.startDate)})
                  </div>
                  <span className="badge green">Registrado</span>
                </div>
              ))}
              {employee.leaves.length === 0 && (
                <div className="small muted">Nenhum registro de férias anterior cadastrado.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* EPIs e Segurança do Trabalho */}
      <div className="card flush mt">
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <ShieldCheck size={16} /> Meus EPIs e Exames Ocupacionais (SST)
          </h3>
          <div className="small muted">Controle de equipamentos de proteção individual (NR-06) e Atestado Médico Ocupacional (NR-07)</div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item / Exame</th>
                <th>Tipo</th>
                <th>Nº CA / CRM</th>
                <th>Data Entrega / Realização</th>
                <th>Validade</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {employee.safetyRecords.map((r) => {
                const isExpired = r.expiresAt && r.expiresAt < now;
                return (
                  <tr key={r.id}>
                    <td className="bold">{r.title}</td>
                    <td>{r.recordType}</td>
                    <td>{r.caNumber || "—"}</td>
                    <td>{fmtDate(r.issuedAt)}</td>
                    <td>{r.expiresAt ? fmtDate(r.expiresAt) : "Sem prazo"}</td>
                    <td>
                      <span className={`badge ${isExpired ? "red" : "green"}`}>
                        {isExpired ? "Vencido" : "Vigente / Regular"}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {employee.safetyRecords.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    Nenhum registro de EPI ou exame ocupacional emitido até o momento.
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
