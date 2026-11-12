import { NextResponse, type NextRequest } from "next/server";
import { runSystemAutomations } from "@/lib/automation";
import { getSession, requireAdmin } from "@/lib/auth";

export async function POST() {
  try {
    await requireAdmin();
    const result = await runSystemAutomations({ forcePayroll: true });
    return NextResponse.json({ ok: true, result });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ ok: false, error: errorMsg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET?.trim();
    const authHeader = request.headers.get("authorization") || "";
    const hasValidCronToken = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

    if (!hasValidCronToken) {
      const session = await getSession();
      if (!session || session.role !== "ADMIN") {
        return NextResponse.json(
          { ok: false, error: "Não autorizado. Informe CRON_SECRET válido ou acesse como administrador." },
          { status: 401 },
        );
      }
    }

    const result = await runSystemAutomations({ forcePayroll: false });
    return NextResponse.json({ ok: true, result });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ ok: false, error: errorMsg }, { status: 500 });
  }
}
