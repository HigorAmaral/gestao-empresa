import { Sidebar } from "@/components/Sidebar";
import { DynamicBrandTitle } from "@/components/DynamicBrandTitle";
import { requireUser } from "@/lib/auth";
import { getCompanySettings, getSidebarAlerts } from "@/lib/audit";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [session, company, alerts] = await Promise.all([
    requireUser(),
    getCompanySettings(),
    getSidebarAlerts(),
  ]);
  const brandName = company.tradeName?.trim() || company.name || "GestãoPro";

  return (
    <div className="app">
      <DynamicBrandTitle brandName={brandName} />
      <Sidebar session={session} brandName={brandName} alerts={alerts} />
      <main className="main">{children}</main>
    </div>
  );
}
