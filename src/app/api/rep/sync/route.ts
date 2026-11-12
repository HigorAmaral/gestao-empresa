import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { computeDayMinutes, parseAfdContent } from "@/lib/rh-calc";

/**
 * Endpoint Oficial de Sincronização de Relógio de Ponto Eletrônico (REP-C / REP-P — Portaria 671 & 1510 MTE)
 * Compatível com Webhooks / Push API de máquinas Control iD (iDClass/iDFace), Henry (Prisma/Hexa), Topdata (Inner Rep), Dimep e Intelbras.
 */
export async function POST(request: Request) {
  try {
    await ensureStockLocationTables();
    const authHeader = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    const body = await request.json().catch(() => ({}));
    const token = authHeader || body.apiToken || "";

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Token de autenticação da máquina REP ausente (Authorization Bearer ou apiToken)." },
        { status: 401 }
      );
    }

    const machine = await prisma.timeClockMachine.findFirst({
      where: { apiToken: token, active: true },
    });

    if (!machine) {
      return NextResponse.json(
        { ok: false, error: "Relógio de Ponto não encontrado ou inativo para o token informado." },
        { status: 403 }
      );
    }

    const employees = await prisma.employee.findMany({ where: { active: true } });

    type RawPunch = {
      pis?: string;
      cpf?: string;
      employeeId?: number;
      date: string;
      time: string;
      nsr?: string;
    };

    const incomingPunches: RawPunch[] = Array.isArray(body.punches) ? [...body.punches] : [];

    if (typeof body.afdRaw === "string" && body.afdRaw.trim()) {
      const parsedDays = parseAfdContent(body.afdRaw);
      for (const dayRow of parsedDays) {
        for (const t of dayRow.punches) {
          incomingPunches.push({
            pis: dayRow.pisOrDoc,
            cpf: dayRow.pisOrDoc,
            date: dayRow.date,
            time: t,
            nsr: dayRow.nsr,
          });
        }
      }
    }

    if (incomingPunches.length === 0) {
      return NextResponse.json({
        ok: true,
        machine: machine.name,
        message: "Conexão com Relógio de Ponto validada com sucesso. Nenhuma batida pendente no payload.",
        syncedRecords: 0,
      });
    }

    // Agrupa batidas por funcionário + data
    const grouped = new Map<string, { employee: typeof employees[number]; date: string; times: string[]; nsr?: string }>();

    for (const p of incomingPunches) {
      const cleanPis = (p.pis || "").replace(/\D/g, "");
      const cleanCpf = (p.cpf || "").replace(/\D/g, "");

      const emp = employees.find((e) => {
        if (p.employeeId && e.id === Number(p.employeeId)) return true;
        const empPis = (e.pis || "").replace(/\D/g, "");
        const empCpf = (e.document || "").replace(/\D/g, "");
        if (cleanPis && empPis && empPis === cleanPis) return true;
        if (cleanCpf && empCpf && empCpf === cleanCpf) return true;
        return false;
      });

      if (!emp || !/^\d{4}-\d{2}-\d{2}$/.test(p.date) || !/^\d{2}:\d{2}$/.test(p.time)) {
        continue;
      }

      const key = `${emp.id}__${p.date}`;
      const cur = grouped.get(key) || { employee: emp, date: p.date, times: [], nsr: p.nsr };
      if (!cur.times.includes(p.time)) cur.times.push(p.time);
      if (p.nsr) cur.nsr = p.nsr;
      grouped.set(key, cur);
    }

    let syncedCount = 0;

    for (const item of grouped.values()) {
      const dateObj = new Date(item.date + "T00:00:00.000Z");
      const existing = await prisma.timeClockLog.findFirst({
        where: { employeeId: item.employee.id, date: dateObj },
      });

      const mergedTimes = Array.from(
        new Set(
          [
            existing?.checkIn1,
            existing?.checkOut1,
            existing?.checkIn2,
            existing?.checkOut2,
            ...item.times,
          ].filter((t): t is string => Boolean(t && /^\d{2}:\d{2}$/.test(t)))
        )
      ).sort();

      const checkIn1 = mergedTimes[0] || null;
      const checkOut1 = mergedTimes[1] || null;
      const checkIn2 = mergedTimes[2] || null;
      const checkOut2 = mergedTimes[3] || null;

      const isWeekend = dateObj.getUTCDay() === 0 || dateObj.getUTCDay() === 6;
      const expectedMinutes = isWeekend ? 0 : Math.round((item.employee.workHoursPerDay || 8) * 60);

      const calc = computeDayMinutes(checkIn1, checkOut1, checkIn2, checkOut2, expectedMinutes);

      if (existing) {
        await prisma.timeClockLog.update({
          where: { id: existing.id },
          data: {
            machineId: machine.id,
            checkIn1,
            checkOut1,
            checkIn2,
            checkOut2,
            workedMinutes: calc.workedMinutes,
            expectedMinutes,
            overtimeMinutes: calc.overtimeMinutes,
            lateMinutes: calc.lateMinutes,
            nsr: item.nsr || existing.nsr || null,
            source: "WEBHOOK_API",
          },
        });
      } else {
        await prisma.timeClockLog.create({
          data: {
            employeeId: item.employee.id,
            machineId: machine.id,
            date: dateObj,
            checkIn1,
            checkOut1,
            checkIn2,
            checkOut2,
            workedMinutes: calc.workedMinutes,
            expectedMinutes,
            overtimeMinutes: calc.overtimeMinutes,
            lateMinutes: calc.lateMinutes,
            nsr: item.nsr || null,
            source: "WEBHOOK_API",
          },
        });
      }
      syncedCount++;
    }

    await prisma.timeClockMachine.update({
      where: { id: machine.id },
      data: {
        lastSyncAt: new Date(),
        totalSynced: { increment: syncedCount },
      },
    });

    return NextResponse.json({
      ok: true,
      machine: machine.name,
      syncedRecords: syncedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Erro na sincronização REP:", err);
    return NextResponse.json(
      { ok: false, error: "Falha interna ao processar batidas da máquina de ponto." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: "API de Integração Relógio de Ponto Eletrônico (REP-C / REP-P — Portaria 671 MTE)",
    status: "online",
    supportedBrands: ["Control iD (iDClass / iDFace)", "Henry (Prisma / Hexa)", "Topdata (Inner Rep)", "Dimep (PrintPoint)", "Intelbras"],
    method: "POST /api/rep/sync com header Authorization: Bearer <apiToken> ou body.apiToken",
  });
}
