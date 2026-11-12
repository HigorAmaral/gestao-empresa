import { NextResponse } from "next/server";
import { runSystemAutomations } from "@/lib/automation";
import { requireAdmin } from "@/lib/auth";

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

export async function GET() {
  try {
    const result = await runSystemAutomations({ forcePayroll: true });
    return NextResponse.json({ ok: true, result });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ ok: false, error: errorMsg }, { status: 500 });
  }
}
