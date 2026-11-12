import { requireModule } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import {
  getItTicketsList,
  getItAssetsList,
  getSystemHealthMetrics,
} from "@/lib/it-tickets";
import { getSecurityDashboardData } from "@/lib/security";
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
  const session = await requireModule("ti");

  const params = await searchParams;
  const [{ tickets, metrics }, assets, health, securityData] = await Promise.all([
    getItTicketsList(params),
    getItAssetsList(),
    getSystemHealthMetrics(),
    getSecurityDashboardData(),
  ]);

  const isAdmin = session.role === "ADMIN" || hasModuleAccess(session, "ti");

  return (
    <>
      <PageHeader
        title="Central de Operações de TI & Cibersegurança"
        subtitle="Área reservada para gestão de chamados, escudo contra ataques (WAF), inventário de ativos e monitoramento"
        actions={<NewInternalTicketModal userName={session.name} />}
      />

      <TicketManagementView
        initialTickets={tickets}
        assets={assets}
        health={health}
        securityData={securityData}
        metrics={metrics}
        userName={session.name}
        isAdmin={isAdmin}
        initialTab={params.tab || "chamados"}
      />
    </>
  );
}
