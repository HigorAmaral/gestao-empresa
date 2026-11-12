import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getCompanySettings } from "@/lib/audit";
import { brl, fmtDate, todayInput } from "@/lib/format";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { calculateCompletePayslip } from "@/lib/rh-calc";
import { PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";

export default async function EmployeePayslipPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("funcionarios");
  await ensureStockLocationTables();

  const { id } = await params;
  const sp = await searchParams;
  const refMonth = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : todayInput().slice(0, 7);
  const [y, m] = refMonth.split("-");
  const refLabel = `${m}/${y}`;

  const [employee, company] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: Number(id) },
      include: {
        payrollEvents: { where: { month: refMonth }, orderBy: { id: "asc" } },
      },
    }),
    getCompanySettings(),
  ]);
  if (!employee) notFound();

  const calc = calculateCompletePayslip(employee, employee.payrollEvents);

  return (
    <>
      <PageHeader
        title={`Holerite Oficial — ${employee.name}`}
        subtitle={`Demonstrativo de Pagamento de Salário (${employee.contractType || "CLT"}) referente à competência ${refLabel}`}
        actions={
          <>
            <form method="GET" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="month" name="mes" defaultValue={refMonth} style={{ width: 150, padding: "5px 8px" }} />
              <button type="submit" className="btn sm secondary">
                Ver Mês
              </button>
            </form>
            <Link className="btn secondary" href={`/funcionarios?tab=folha&month=${refMonth}`}>
              <ArrowLeft size={15} /> Voltar ao RH
            </Link>
            <PrintButton label="Imprimir Holerite / Salvar PDF" />
          </>
        }
      />

      <div className="print-doc">
        <div className="doc-header">
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {company.logoUrl && (
              <img
                src={company.logoUrl}
                alt={company.tradeName || company.name}
                style={{ maxHeight: 85, maxWidth: 220, objectFit: "contain", borderRadius: 6, flexShrink: 0 }}
              />
            )}
            <div>
              <h1>{company.tradeName || company.name}</h1>
              <div className="small muted">{company.name}</div>
              {company.document && <div className="small">CNPJ Empregador: {company.document}</div>}
              <div className="small">
                {[company.address, company.city, company.state].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
          <div className="doc-title">
            <h2>RECIBO DE PAGAMENTO DE SALÁRIO</h2>
            <div className="small bold">Competência / Mês Ref.: {refLabel}</div>
            <div className="small">Regime: {employee.contractType || "CLT"}</div>
            <div className="small">Emissão: {new Date().toLocaleDateString("pt-BR")}</div>
          </div>
        </div>

        <div className="grid grid-2" style={{ marginBottom: 14 }}>
          <div>
            <div className="small muted bold">IDENTIFICAÇÃO DO COLABORADOR(A)</div>
            <div className="bold" style={{ fontSize: 15 }}>
              #{String(employee.id).padStart(4, "0")} — {employee.name}
            </div>
            <div className="small">
              CPF: {employee.document || "Não informado"} {employee.pis ? `· PIS/NIS: ${employee.pis}` : ""}
            </div>
            <div className="small">
              CTPS: {employee.ctps || "Digital"} · Admissão: {fmtDate(employee.hireDate)}
            </div>
          </div>
          <div>
            <div className="small muted bold">CARGO, LOTAÇÃO & DADOS DE PAGAMENTO</div>
            <div className="bold">{employee.position}</div>
            <div className="small">
              Departamento: {employee.department || "Geral"} · Jornada: {employee.workHoursPerDay || 8}h/dia ({employee.workSchedule || "08:00-17:00"})
            </div>
            <div className="small">
              {employee.bankInfo ? `Banco: ${employee.bankInfo}` : ""}
              {employee.pixKey ? ` · Chave PIX: ${employee.pixKey}` : ""}
            </div>
          </div>
        </div>

        <div className="doc-section">
          <div className="small muted bold mb">DISCRIMINAÇÃO DAS VERBAS (PROVENTOS E DESCONTOS)</div>
          <table>
            <thead>
              <tr>
                <th style={{ width: 65 }}>Cód.</th>
                <th>Descrição da Rubrica</th>
                <th style={{ width: 110 }}>Referência</th>
                <th className="num" style={{ width: 140 }}>
                  Vencimentos (R$)
                </th>
                <th className="num" style={{ width: 140 }}>
                  Descontos (R$)
                </th>
              </tr>
            </thead>
            <tbody>
              {calc.lines.map((line, idx) => (
                <tr key={idx}>
                  <td className="mono">{line.code}</td>
                  <td>{line.description}</td>
                  <td className="mono small">{line.reference}</td>
                  <td className="num bold">{line.type === "PROVENTO" ? brl(line.amount) : ""}</td>
                  <td className="num">{line.type === "DESCONTO" ? brl(line.amount) : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="bold">
                  TOTAIS BRUTO / DESCONTOS
                </td>
                <td className="num bold">{brl(calc.totalAdditions)}</td>
                <td className="num bold">{brl(calc.totalDeductions)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Quadro de Bases Legais CLT (INSS, FGTS, IRRF) */}
        <div
          className="doc-section"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 10,
            background: "rgba(0,0,0,0.03)",
            padding: "10px 12px",
            borderRadius: 6,
            border: "1px solid #ddd",
            marginTop: 12,
          }}
        >
          <div>
            <div className="small muted">Salário Base</div>
            <div className="bold small">{brl(calc.baseSalary)}</div>
          </div>
          <div>
            <div className="small muted">Salário Contr. INSS</div>
            <div className="bold small">{brl(calc.inssBase)}</div>
          </div>
          <div>
            <div className="small muted">Base Cálc. FGTS</div>
            <div className="bold small">{brl(calc.fgtsBase)}</div>
          </div>
          <div>
            <div className="small muted">FGTS do Mês (8%)</div>
            <div className="bold small">{brl(calc.fgtsAmount)}</div>
          </div>
          <div>
            <div className="small muted">Base Cálc. IRRF</div>
            <div className="bold small">{brl(calc.irrfBase)}</div>
          </div>
        </div>

        <div className="doc-section">
          <div className="totals">
            <div className="line">
              <span>Total de Vencimentos (Proventos)</span>
              <span>{brl(calc.totalAdditions)}</span>
            </div>
            <div className="line">
              <span>Total de Descontos Legais / Adiantamentos</span>
              <span>- {brl(calc.totalDeductions)}</span>
            </div>
            <div className="line total">
              <span>LÍQUIDO A RECEBER</span>
              <span>{brl(calc.netSalary)}</span>
            </div>
          </div>
        </div>

        {employee.vrAmount > 0 && (
          <div className="doc-section small muted">
            * Benefício Crédito em Cartão Vale-Refeição/Alimentação do mês: <strong>{brl(employee.vrAmount)}</strong> (não integra salário).
          </div>
        )}

        <div className="doc-section small">
          Declaro ter recebido a importância líquida de <strong>{brl(calc.netSalary)}</strong> discriminada neste demonstrativo, dando plena, rasa e geral quitação pelos serviços prestados na competência <strong>{refLabel}</strong>.
        </div>

        <div className="signatures">
          <div className="sig-line">{company.tradeName || company.name} — Empregador</div>
          <div className="sig-line">
            {employee.name} — Assinatura do Colaborador(a) · Data: ____/____/______
          </div>
        </div>
      </div>
    </>
  );
}
