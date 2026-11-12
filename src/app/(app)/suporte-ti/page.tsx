import { Headphones, ShieldCheck, Ticket } from "lucide-react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getItTicketsList } from "@/lib/it-tickets";
import { TicketManagementView } from "./TicketManagementView";
import { NewInternalTicketModal } from "./NewInternalTicketModal";

export const dynamic = "force-dynamic";

export default async function SuporteTiPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; priority?: string; search?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const { tickets, metrics } = await getItTicketsList(params);

  const isAdmin = session.role === "ADMIN";

  return (
    <>
      <PageHeader
        title="Central de Suporte & Chamados de TI"
        subtitle="Gestão de chamados de tecnologia, helpdesk interno, suporte a usuários e infraestrutura"
        actions={<NewInternalTicketModal userName={session.name} />}
      />

      <TicketManagementView
        initialTickets={tickets}
        metrics={metrics}
        userName={session.name}
        isAdmin={isAdmin}
      />
    </>
  );
}
