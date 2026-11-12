import Link from "next/link";
import { ArrowLeft, Building2, CheckCircle2, FileUp, Sparkles, Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { PageHeader } from "@/components/ui";
import { OfxReconcileClient } from "./OfxReconcileClient";

export default async function ConciliacaoOfxPage() {
  await requireAdmin();
  await ensureStockLocationTables();

  const [pendingEntries, bankAccounts] = await Promise.all([
    prisma.financialEntry.findMany({
      where: { status: "PENDENTE" },
      orderBy: { dueDate: "asc" },
      include: {
        sale: { include: { client: true } },
        serviceOrder: { include: { client: true } },
        purchase: { include: { supplier: true } },
      },
    }),
    prisma.bankAccount.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Conciliação Bancária Automatizada (OFX)"
        subtitle="Importe o extrato .OFX do seu banco (Itaú, Bradesco, BB, Inter, Nubank, Sicredi, etc.) e concilie contas a pagar e receber em segundos."
        actions={
          <Link href="/financeiro" className="btn secondary">
            <ArrowLeft size={16} /> Voltar ao Financeiro
          </Link>
        }
      />

      <OfxReconcileClient
        pendingEntries={pendingEntries.map((e) => ({
          id: e.id,
          type: e.type,
          description: e.description,
          category: e.category || "Geral",
          amount: e.amount,
          dueDate: e.dueDate.toISOString(),
          clientOrSupplier:
            e.sale?.client?.name ||
            e.serviceOrder?.client?.name ||
            e.purchase?.supplier?.name ||
            null,
        }))}
        bankAccounts={bankAccounts.map((b) => ({
          id: b.id,
          name: b.name,
          bankName: b.bankName,
        }))}
      />
    </>
  );
}
