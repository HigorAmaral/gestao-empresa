/**
 * Motor de Cálculo Trabalhista (CLT / PJ / Estágio) — INSS, IRRF, FGTS, Férias, 13º
 * e Parser Oficial de Arquivo AFD de Relógios de Ponto (Portaria 1510 e Portaria 671 MTE).
 */

export type PayslipLine = {
  code: string;
  description: string;
  reference: string;
  type: "PROVENTO" | "DESCONTO";
  amount: number;
};

export type CompletePayslipResult = {
  lines: PayslipLine[];
  baseSalary: number;
  inssBase: number;
  inssAmount: number;
  fgtsBase: number;
  fgtsAmount: number;
  irrfBase: number;
  irrfAmount: number;
  totalAdditions: number;
  totalDeductions: number;
  netSalary: number;
  provision13th: number;
  provisionVacation: number;
};

/** Calcula o INSS progressivo por faixas (Tabela Vigente CLT) */
export function calculateInss(grossBase: number): { amount: number; effectiveRate: number } {
  if (grossBase <= 0) return { amount: 0, effectiveRate: 0 };

  const brackets = [
    { limit: 1518.0, rate: 0.075 },
    { limit: 2793.88, rate: 0.09 },
    { limit: 4190.83, rate: 0.12 },
    { limit: 8157.41, rate: 0.14 },
  ];

  let remaining = Math.min(grossBase, brackets[brackets.length - 1].limit);
  let prevLimit = 0;
  let total = 0;

  for (const b of brackets) {
    if (remaining > prevLimit) {
      const taxableInBracket = Math.min(remaining, b.limit) - prevLimit;
      total += taxableInBracket * b.rate;
      prevLimit = b.limit;
    }
  }

  const amount = Number(total.toFixed(2));
  const effectiveRate = Number(((amount / grossBase) * 100).toFixed(2));
  return { amount, effectiveRate };
}

/** Calcula o IRRF progressivo deduzindo INSS e dependentes (ou desconto simplificado se mais vantajoso) */
export function calculateIrrf(
  grossBase: number,
  inssAmount: number,
  dependentsCount: number,
): { base: number; amount: number; rate: number } {
  if (grossBase <= 0) return { base: 0, amount: 0, rate: 0 };

  const legalDeductions = inssAmount + dependentsCount * 189.59;
  const simplifiedDiscount = 564.8;
  const effectiveDeduction = Math.max(legalDeductions, simplifiedDiscount);
  const base = Math.max(0, Number((grossBase - effectiveDeduction).toFixed(2)));

  if (base <= 2259.2) return { base, amount: 0, rate: 0 };
  if (base <= 2826.65) return { base, amount: Math.max(0, Number((base * 0.075 - 169.44).toFixed(2))), rate: 7.5 };
  if (base <= 3751.05) return { base, amount: Math.max(0, Number((base * 0.15 - 381.44).toFixed(2))), rate: 15 };
  if (base <= 4664.68) return { base, amount: Math.max(0, Number((base * 0.225 - 662.77).toFixed(2))), rate: 22.5 };
  return { base, amount: Math.max(0, Number((base * 0.275 - 896.0).toFixed(2))), rate: 27.5 };
}

export function calculateCompletePayslip(
  emp: {
    salary: number;
    contractType?: string | null;
    dependentsCount?: number | null;
    vtDaily?: number | null;
    vtOptIn?: boolean | null;
    healthPlanDeduction?: number | null;
    hazardAdditionPct?: number | null;
  },
  events: {
    id?: number;
    type: string;
    category: string;
    description: string;
    reference?: string | null;
    amount: number;
  }[],
): CompletePayslipResult {
  const isClt = (emp.contractType ?? "CLT") === "CLT";
  const baseSalary = Number((emp.salary || 0).toFixed(2));
  const lines: PayslipLine[] = [];

  // 1. Salário Base / Bolsa / Honorários
  lines.push({
    code: "001",
    description:
      emp.contractType === "PJ"
        ? "Prestação de Serviços (Contrato PJ)"
        : emp.contractType === "ESTAGIO"
          ? "Bolsa-Auxílio Estágio"
          : "Salário Base Mensal",
    reference: "30 dias / 220h",
    type: "PROVENTO",
    amount: baseSalary,
  });

  // 2. Adicional de Insalubridade / Periculosidade
  const hazardPct = emp.hazardAdditionPct ?? 0;
  const hazardAmount = hazardPct > 0 ? Number(((baseSalary * hazardPct) / 100).toFixed(2)) : 0;
  if (hazardAmount > 0) {
    lines.push({
      code: "002",
      description: "Adicional de Insalubridade / Periculosidade",
      reference: `${hazardPct}%`,
      type: "PROVENTO",
      amount: hazardAmount,
    });
  }

  // 3. Eventos do Mês (Horas Extras do Ponto REP, Bônus, Vales, Faltas/Atrasos)
  let extraProventos = 0;
  let faltasDescontos = 0;

  events.forEach((ev, idx) => {
    const isProvento = ev.type === "PROVENTO";
    if (isProvento) extraProventos += ev.amount;
    if (!isProvento && ev.category === "FALTA_ATRASO") faltasDescontos += ev.amount;

    lines.push({
      code: isProvento ? String(10 + idx).padStart(3, "0") : String(200 + idx).padStart(3, "0"),
      description: ev.description,
      reference: ev.reference || (isProvento ? "Provento" : "Desconto"),
      type: isProvento ? "PROVENTO" : "DESCONTO",
      amount: Number(ev.amount.toFixed(2)),
    });
  });

  // 4. Desconto de Vale-Transporte (até 6% do salário base ou custo real)
  if (isClt && emp.vtOptIn) {
    const vtMonthlyCost = (emp.vtDaily || 0) * 22;
    const maxLegalVt = Number((baseSalary * 0.06).toFixed(2));
    const vtDeduction = vtMonthlyCost > 0 ? Math.min(maxLegalVt, vtMonthlyCost) : maxLegalVt;
    if (vtDeduction > 0) {
      lines.push({
        code: "105",
        description: "Vale-Transporte (Quota Parte Colaborador)",
        reference: "6,0%",
        type: "DESCONTO",
        amount: Number(vtDeduction.toFixed(2)),
      });
    }
  }

  // 5. Desconto de Plano de Saúde / Odontológico
  if ((emp.healthPlanDeduction ?? 0) > 0) {
    lines.push({
      code: "108",
      description: "Plano de Saúde / Odontológico Coparticipação",
      reference: "Mensal",
      type: "DESCONTO",
      amount: Number((emp.healthPlanDeduction ?? 0).toFixed(2)),
    });
  }

  // 6. Base Tributável INSS / FGTS / IRRF (apenas CLT)
  const taxableBase = Math.max(0, Number((baseSalary + hazardAmount + extraProventos - faltasDescontos).toFixed(2)));
  const inss = isClt ? calculateInss(taxableBase) : { amount: 0, effectiveRate: 0 };
  const irrf = isClt
    ? calculateIrrf(taxableBase, inss.amount, emp.dependentsCount ?? 0)
    : { base: 0, amount: 0, rate: 0 };
  const fgtsAmount = isClt ? Number((taxableBase * 0.08).toFixed(2)) : 0;

  if (inss.amount > 0) {
    lines.push({
      code: "901",
      description: "INSS sobre Salário / Remuneração",
      reference: `${inss.effectiveRate}%`,
      type: "DESCONTO",
      amount: inss.amount,
    });
  }

  if (irrf.amount > 0) {
    lines.push({
      code: "902",
      description: "IRRF — Imposto de Renda Retido na Fonte",
      reference: `${irrf.rate}%`,
      type: "DESCONTO",
      amount: irrf.amount,
    });
  }

  const totalAdditions = Number(
    lines
      .filter((l) => l.type === "PROVENTO")
      .reduce((s, l) => s + l.amount, 0)
      .toFixed(2),
  );
  const totalDeductions = Number(
    lines
      .filter((l) => l.type === "DESCONTO")
      .reduce((s, l) => s + l.amount, 0)
      .toFixed(2),
  );
  const netSalary = Math.max(0, Number((totalAdditions - totalDeductions).toFixed(2)));

  const provision13th = isClt ? Number((taxableBase / 12).toFixed(2)) : 0;
  const provisionVacation = isClt ? Number(((taxableBase / 12) * 1.3333).toFixed(2)) : 0;

  return {
    lines,
    baseSalary,
    inssBase: isClt ? taxableBase : 0,
    inssAmount: inss.amount,
    fgtsBase: isClt ? taxableBase : 0,
    fgtsAmount,
    irrfBase: irrf.base,
    irrfAmount: irrf.amount,
    totalAdditions,
    totalDeductions,
    netSalary,
    provision13th,
    provisionVacation,
  };
}

// ---------- Parser de Arquivo AFD de Relógios de Ponto (Portaria 1510 / 671 MTE) ----------

export type ParsedRepDayPunch = {
  pisOrDoc: string;
  date: string; // YYYY-MM-DD
  nsr: string;
  punches: string[]; // ["08:00", "12:00", "13:00", "17:30"]
};

function hhmmToMin(hhmm?: string | null): number | null {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function computeDayMinutes(
  checkIn1?: string | null,
  checkOut1?: string | null,
  checkIn2?: string | null,
  checkOut2?: string | null,
  expectedMinutes = 480,
) {
  const m1 = hhmmToMin(checkIn1);
  const m2 = hhmmToMin(checkOut1);
  const m3 = hhmmToMin(checkIn2);
  const m4 = hhmmToMin(checkOut2);

  let worked = 0;
  if (m1 !== null && m2 !== null && m2 > m1) worked += m2 - m1;
  if (m3 !== null && m4 !== null && m4 > m3) worked += m4 - m3;
  // Caso só tenha batido entrada e saída direta
  if (worked === 0 && m1 !== null && m4 !== null && m4 > m1) {
    worked = Math.max(0, m4 - m1 - 60);
  }

  const diff = worked - expectedMinutes;
  return {
    workedMinutes: worked,
    overtimeMinutes: diff > 10 ? diff : 0, // Tolerância legal CLT de 10 minutos (Art. 58 § 1º CLT)
    lateMinutes: diff < -10 ? Math.abs(diff) : 0,
  };
}

/**
 * Lê arquivos AFD padrão Portaria 1510 MTE (Registro Tipo 3) ou Portaria 671 MTE (ISO Timestamp)
 */
export function parseAfdContent(afdText: string): ParsedRepDayPunch[] {
  const lines = afdText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const grouped = new Map<string, ParsedRepDayPunch>();

  for (const line of lines) {
    // Formato 1: Portaria 671 (NSR + Tipo '3' ou '7' + ISO Date 2026-11-10T08:00:00-0300 + PIS/CPF)
    const isoMatch = line.match(/^(\d{9})[37](\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):\d{2}[+-]\d{4}\s*(\d{11,12})/);
    if (isoMatch) {
      const [, nsr, dateStr, hhmm, doc] = isoMatch;
      const cleanDoc = doc.replace(/\D/g, "");
      const key = `${cleanDoc}_${dateStr}`;
      const cur = grouped.get(key) ?? { pisOrDoc: cleanDoc, date: dateStr, nsr, punches: [] };
      if (!cur.punches.includes(hhmm)) cur.punches.push(hhmm);
      grouped.set(key, cur);
      continue;
    }

    // Formato 2: Portaria 1510 clássica (NSR 9 dígitos + '3' + DDMMAAAA 8 dígitos + HHMM 4 dígitos + PIS 12 dígitos)
    if (line.length >= 34 && line[9] === "3" && /^\d+$/.test(line.slice(0, 34))) {
      const nsr = line.slice(0, 9);
      const dd = line.slice(10, 12);
      const mm = line.slice(12, 14);
      const yyyy = line.slice(14, 18);
      const hh = line.slice(18, 20);
      const min = line.slice(20, 22);
      const pis = line.slice(22, 34).replace(/^0+/, "");
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const hhmm = `${hh}:${min}`;
      const key = `${pis}_${dateStr}`;
      const cur = grouped.get(key) ?? { pisOrDoc: pis, date: dateStr, nsr, punches: [] };
      if (!cur.punches.includes(hhmm)) cur.punches.push(hhmm);
      grouped.set(key, cur);
      continue;
    }

    // Formato 3: CSV / TXT exportado de relógios (PIS/CPF;YYYY-MM-DD;08:00;12:00;13:00;17:30)
    const parts = line.split(/[;,|\t]/).map((s) => s.trim());
    if (parts.length >= 3 && /\d{4}-\d{2}-\d{2}/.test(parts[1])) {
      const cleanDoc = parts[0].replace(/\D/g, "");
      const dateStr = parts[1].slice(0, 10);
      const times = parts.slice(2).filter((t) => /^\d{2}:\d{2}$/.test(t));
      if (cleanDoc && times.length > 0) {
        const key = `${cleanDoc}_${dateStr}`;
        grouped.set(key, {
          pisOrDoc: cleanDoc,
          date: dateStr,
          nsr: String(grouped.size + 1).padStart(9, "0"),
          punches: times,
        });
      }
    }
  }

  for (const val of grouped.values()) {
    val.punches.sort();
  }

  return [...grouped.values()];
}
