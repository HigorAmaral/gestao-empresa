import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateCompletePayslip, computeDayMinutes } from "@/lib/rh-calc";

export type PayrollRunResult = {
  label: string;
  employees: number;
  totalNet: number;
  totalFgts: number;
  totalInssIrrf: number;
};

/**
 * Motor único de fechamento da folha (usado pela tela de Folha e pela Central de Automações):
 * 1. (Opcional) Sincroniza batidas da máquina REP caso o mês esteja vazio;
 * 2. Converte Horas Extras (+50%) e Atrasos do ponto em rubricas do holerite;
 * 3. Calcula INSS, IRRF, VT, FGTS e Líquido;
 * 4. Cria ou atualiza os títulos (salários + FGTS + DARF) no Financeiro — sem duplicar.
 */
export async function processPayrollForMonth(
  month: string,
  opts: { simulateRepIfEmpty?: boolean } = {},
): Promise<PayrollRunResult> {
  const [y, m] = month.split("-").map(Number);
  const startOfMonth = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(y, m, 0, 23, 59, 59));
  const label = `${String(m).padStart(2, "0")}/${y}`;

  const employees = await prisma.employee.findMany({ where: { active: true, salary: { gt: 0 } } });

  if (opts.simulateRepIfEmpty) {
    const machine = await prisma.timeClockMachine.findFirst({ where: { active: true } });
    const existingLogsCount = await prisma.timeClockLog.count({
      where: { date: { gte: startOfMonth, lte: endOfMonth } },
    });
    if (existingLogsCount === 0 && machine) {
      let nsrSeq = 21000;
      const rows: Prisma.TimeClockLogCreateManyInput[] = [];
      for (const emp of employees) {
        for (const d of [3, 4, 5, 6, 7, 10, 11]) {
          const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
          if (dt.getUTCDay() === 0 || dt.getUTCDay() === 6) continue;
          const checkOut2 = (emp.id + d) % 3 === 0 ? "18:00" : "17:00";
          const calc = computeDayMinutes("08:00", "12:00", "13:00", checkOut2, 480);
          nsrSeq += 4;
          rows.push({
            employeeId: emp.id,
            machineId: machine.id,
            date: dt,
            nsr: String(nsrSeq).padStart(9, "0"),
            checkIn1: "08:00",
            checkOut1: "12:00",
            checkIn2: "13:00",
            checkOut2,
            workedMinutes: calc.workedMinutes,
            expectedMinutes: 480,
            overtimeMinutes: calc.overtimeMinutes,
            lateMinutes: calc.lateMinutes,
            source: "REP_AFD",
            syncedToPayroll: true,
          });
        }
      }
      if (rows.length) await prisma.timeClockLog.createMany({ data: rows });
    }
  }

  // Ponto REP → rubricas (lote único de leitura)
  const [monthLogs, allEvents, existingEntries] = await Promise.all([
    prisma.timeClockLog.findMany({ where: { date: { gte: startOfMonth, lte: endOfMonth } } }),
    prisma.employeePayrollEvent.findMany({ where: { month } }),
    prisma.financialEntry.findMany({ where: { description: { contains: `ref. ${label}` } } }),
  ]);

  await prisma.employeePayrollEvent.deleteMany({
    where: { month, description: { contains: "(Relógio REP:" } },
  });
  const manualEvents = allEvents.filter((e) => !e.description.includes("(Relógio REP:"));

  const fmtHm = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}m`;
  const newRepEvents: {
    employeeId: number;
    month: string;
    type: string;
    category: string;
    description: string;
    reference: string;
    amount: number;
  }[] = [];

  for (const emp of employees) {
    const empLogs = monthLogs.filter((l) => l.employeeId === emp.id);
    const otMin = empLogs.reduce((s, l) => s + (l.overtimeMinutes || 0), 0);
    const lateMin = empLogs.reduce((s, l) => s + (l.lateMinutes || 0), 0);
    const hourlyRate = emp.salary / ((emp.workHoursPerDay || 8) * 27.5 || 220);

    if (otMin >= 10) {
      const amount = Math.round((otMin / 60) * hourlyRate * 1.5 * 100) / 100;
      if (amount > 0)
        newRepEvents.push({
          employeeId: emp.id,
          month,
          type: "PROVENTO",
          category: "HORA_EXTRA",
          description: `Horas Extras 50% (Relógio REP: ${fmtHm(otMin)})`,
          reference: fmtHm(otMin),
          amount,
        });
    }
    if (lateMin >= 15) {
      const amount = Math.round((lateMin / 60) * hourlyRate * 100) / 100;
      if (amount > 0)
        newRepEvents.push({
          employeeId: emp.id,
          month,
          type: "DESCONTO",
          category: "FALTA_ATRASO",
          description: `Atrasos / Faltas (Relógio REP: ${fmtHm(lateMin)})`,
          reference: fmtHm(lateMin),
          amount,
        });
    }
  }
  if (newRepEvents.length) await prisma.employeePayrollEvent.createMany({ data: newRepEvents });

  // Cálculo dos holerites e títulos financeiros
  const dueDate = new Date(Date.UTC(y, m, 5));
  const fgtsDue = new Date(Date.UTC(y, m, 20));
  let totalNet = 0;
  let totalFgts = 0;
  let totalInssIrrf = 0;
  const writes: Promise<unknown>[] = [];

  for (const emp of employees) {
    const events = [
      ...manualEvents.filter((e) => e.employeeId === emp.id),
      ...newRepEvents.filter((e) => e.employeeId === emp.id),
    ];
    const calc = calculateCompletePayslip(emp, events);
    totalNet += calc.netSalary;
    totalFgts += calc.fgtsAmount;
    totalInssIrrf += calc.inssAmount + calc.irrfAmount;

    const notes = `Bruto: R$ ${calc.totalAdditions.toFixed(2)} | Descontos: R$ ${calc.totalDeductions.toFixed(2)} (INSS: R$ ${calc.inssAmount.toFixed(2)}, IRRF: R$ ${calc.irrfAmount.toFixed(2)}, FGTS: R$ ${calc.fgtsAmount.toFixed(2)})`;
    const existing = existingEntries.find(
      (f) => f.category === "Salários" && f.description.startsWith("Salário Líquido") && f.description.includes(emp.name),
    );
    if (existing) {
      if (existing.status !== "PAGO") {
        writes.push(prisma.financialEntry.update({ where: { id: existing.id }, data: { amount: calc.netSalary, notes } }));
      }
    } else {
      writes.push(
        prisma.financialEntry.create({
          data: {
            type: "DESPESA",
            description: `Salário Líquido ${emp.name} (${emp.contractType || "CLT"}) — ref. ${label}`,
            category: "Salários",
            amount: calc.netSalary,
            dueDate,
            notes,
          },
        }),
      );
    }
  }

  const upsertGuide = (description: string, amount: number) => {
    const existing = existingEntries.find((f) => f.description === description);
    const value = Math.round(amount * 100) / 100;
    if (existing) {
      if (existing.status !== "PAGO") {
        writes.push(prisma.financialEntry.update({ where: { id: existing.id }, data: { amount: value } }));
      }
    } else if (value > 0) {
      writes.push(
        prisma.financialEntry.create({
          data: { type: "DESPESA", description, category: "Impostos", amount: value, dueDate: fgtsDue },
        }),
      );
    }
  };
  upsertGuide(`Guia FGTS Digital (8%) — Folha ref. ${label}`, totalFgts);
  upsertGuide(`DARF Previdenciário (INSS + IRRF Retido) — Folha ref. ${label}`, totalInssIrrf);

  await Promise.all(writes);

  return { label, employees: employees.length, totalNet, totalFgts, totalInssIrrf };
}
