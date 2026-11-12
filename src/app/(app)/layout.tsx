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
      <DynamicBrandTitle brandName={brandName} />
      <Sidebar
        session={session}
        brandName={brandName}
        logoUrl={company.logoUrl}
        alerts={alerts}
        notifications={notifications}
      />
      <main className="main">{children}</main>
    </div>
  );
}
