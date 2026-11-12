import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import {
  getItTicketsList,
  getItAssetsList,
  getSystemHealthMetrics,
} from "@/lib/it-tickets";
import { TicketManagementView } from "./TicketManagementView";
import { NewInternalTicketModal } from "./NewInternalTicketModal";

export const dynamic = "force-dynamic";

export default async function SuporteTiPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    category?: string;
    priority?: string;
    search?: string;
    tab?: string;
  }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const [{ tickets, metrics }, assets, health] = await Promise.all([
    getItTicketsList(params),
    getItAssetsList(),
    getSystemHealthMetrics(),
  ]);

  const isAdmin = session.role === "ADMIN";

  return (
    <>
      <PageHeader
        title="Central de Operações de TI & Tecnologia"
        subtitle="Área reservada para gestão de chamados, inventário de hardware, monitoramento de servidores e base de conhecimento"
        actions={<NewInternalTicketModal userName={session.name} />}
      />

      <TicketManagementView
        initialTickets={tickets}
        assets={assets}
        health={health}
        metrics={metrics}
        userName={session.name}
        isAdmin={isAdmin}
        initialTab={params.tab || "chamados"}
      />
    </>
  );
}
