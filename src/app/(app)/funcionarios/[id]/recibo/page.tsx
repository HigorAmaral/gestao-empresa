import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getCompanySettings } from "@/lib/audit";
import { brl, fmtDate, todayInput } from "@/lib/format";
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
  const { id } = await params;
  const sp = await searchParams;
  const refMonth = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : todayInput().slice(0, 7);
  const [y, m] = refMonth.split("-");
  const refLabel = `${m}/${y}`;

  const [employee, company] = await Promise.all([
    prisma.employee.findUnique({ where: { id: Number(id) } }),
    getCompanySettings(),
  ]);
  if (!employee) notFound();

  return (
    <>
      <PageHeader
        title={`Holerite / Recibo — ${employee.name}`}
        subtitle={`Demonstrativo de pagamento de salário referente a ${refLabel}`}
        actions={
          <>
            <Link className="btn secondary" href="/funcionarios">
              <ArrowLeft size={15} /> Voltar a funcionários
            </Link>
            <PrintButton label="Imprimir Holerite / PDF" />
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
                style={{ maxHeight: 60, maxWidth: 140, objectFit: "contain", borderRadius: 4 }}
              />
            )}
            <div>
              <h1>{company.tradeName || company.name}</h1>
              <div className="small muted">{company.name}</div>
              {company.document && <div className="small">CNPJ: {company.document}</div>}
              <div className="small">
                {[company.address, company.city, company.state].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
          <div className="doc-title">
            <h2>RECIBO DE PAGAMENTO DE SALÁRIO</h2>
            <div className="small">Competência / Mês Ref.: {refLabel}</div>
            <div className="small">Emissão: {new Date().toLocaleDateString("pt-BR")}</div>
          </div>
        </div>

        <div className="grid grid-2">
          <div>
            <div className="small muted bold">COLABORADOR(A)</div>
            <div className="bold">{employee.name}</div>
            <div className="small">CPF: {employee.document || "Não informado"}</div>
            <div className="small">Data de Admissão: {fmtDate(employee.hireDate)}</div>
          </div>
          <div>
            <div className="small muted bold">CARGO / LOTAÇÃO</div>
            <div className="bold">{employee.position}</div>
            <div className="small">Departamento: {employee.department || "Geral"}</div>
            <div className="small">Código Matrícula: #{String(employee.id).padStart(4, "0")}</div>
          </div>
        </div>

        <div className="doc-section">
          <div className="small muted bold mb">DISCRIMINAÇÃO DAS VERBAS</div>
          <table>
            <thead>
              <tr>
                <th>Cód.</th>
                <th>Descrição</th>
                <th>Referência</th>
                <th className="num">Vencimentos (R$)</th>
                <th className="num">Descontos (R$)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>001</td>
                <td>Salário Base Mensal</td>
                <td>30 dias</td>
                <td className="num bold">{brl(employee.salary)}</td>
                <td className="num">{brl(0)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>TOTAIS</td>
                <td className="num">{brl(employee.salary)}</td>
                <td className="num">{brl(0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="doc-section">
          <div className="totals">
            <div className="line total">
              <span>Líquido a Receber</span>
              <span>{brl(employee.salary)}</span>
            </div>
          </div>
        </div>

        <div className="doc-section small">
          Declaro ter recebido a importância líquida discriminada neste recibo, dando plena e geral quitação pelo mês de
          referência <strong>{refLabel}</strong>.
        </div>

        <div className="signatures">
          <div className="sig-line">{company.tradeName || company.name} — Empregador</div>
          <div className="sig-line">{employee.name} — Assinatura do Colaborador(a)</div>
        </div>
      </div>
    </>
  );
}
