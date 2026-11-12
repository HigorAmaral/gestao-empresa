import { Sidebar } from "@/components/Sidebar";
import { DynamicBrandTitle } from "@/components/DynamicBrandTitle";
import { requireUser } from "@/lib/auth";
import { getCompanySettings, getSidebarAlerts } from "@/lib/audit";
import { getNotifications } from "@/lib/notifications";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [session, company, alerts, notifications] = await Promise.all([
    requireUser(),
    getCompanySettings(),
    getSidebarAlerts(),
    getNotifications(),
  ]);
  const brandName = company.tradeName?.trim() || company.name || "GestãoPro";

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">
        Pular para o conteúdo principal
      </a>
      <DynamicBrandTitle brandName={brandName} />
      <Sidebar
        session={session}
        brandName={brandName}
        logoUrl={company.logoUrl}
        alerts={alerts}
        notifications={notifications}
      />
      <main id="main-content" tabIndex={-1} className="main">
        {children}
      </main>
    </div>
  );
}
