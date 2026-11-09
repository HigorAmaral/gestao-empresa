import { Sidebar } from "@/components/Sidebar";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  return (
    <div className="app">
      <Sidebar session={session} />
      <main className="main">{children}</main>
    </div>
  );
}
