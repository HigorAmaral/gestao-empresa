import { Sidebar } from "@/components/Sidebar";
import { requireUser } from "@/lib/auth";
import { getCompanySettings } from "@/lib/audit";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [session, company] = await Promise.all([requireUser(), getCompanySettings()]);
  const brandName = company.tradeName?.trim() || company.name || "GestãoPro";

  return (
    <div className="app">
      <Sidebar session={session} brandName={brandName} />
      <main className="main">{children}</main>
    </div>
  );
}
