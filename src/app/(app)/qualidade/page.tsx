import { requireModule } from "@/lib/auth";
import { getQualityDashboardData } from "@/lib/quality";
import { FlashMessages, PageHeader } from "@/components/ui";
import { QualityDashboardClient } from "./QualityDashboardClient";

export const dynamic = "force-dynamic";

export default async function QualidadePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModule("qualidade");
  const [sp, data] = await Promise.all([searchParams, getQualityDashboardData()]);
  const initialTab = typeof sp.tab === "string" ? sp.tab : "inspecoes";

  return (
    <>
      <PageHeader
        title="Gestão da Qualidade (SGQ)"
        subtitle="Inspeções automáticas de recebimento e produção, checklists de conformidade e tratativa de RNC / CAPA"
      />

      <FlashMessages sp={sp} />

      <div className="stats mb">
        <div className="stat primary">
          <div className="label">Taxa de Aprovação</div>
          <div className="value">{data.metrics.approvalRate}%</div>
          <div className="hint">Defeitos em amostras: {data.metrics.defectRatePct}%</div>
        </div>
        <div className="stat">
          <div className="label">Inspeções Pendentes</div>
          <div className="value">{data.metrics.pendingInspections}</div>
          <div className="hint">{data.metrics.totalInspections} inspeções registradas</div>
        </div>
        <div className="stat">
          <div className="label">RNCs em Aberto</div>
          <div className="value">{data.metrics.openRncs}</div>
          <div className="hint">{data.metrics.criticalRncs} de severidade alta/crítica</div>
        </div>
        <div className="stat">
          <div className="label">RNCs Vencidas</div>
          <div className="value">{data.metrics.overdueRncs}</div>
          <div className="hint">{data.metrics.closedRncs} encerradas no histórico</div>
        </div>
      </div>

      <QualityDashboardClient
        inspections={data.inspections}
        rncs={data.rncs}
        products={data.products}
        byType={data.byType}
        initialTab={initialTab}
      />
    </>
  );
}
