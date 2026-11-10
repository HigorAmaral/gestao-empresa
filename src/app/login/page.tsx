import { getCompanySettings } from "@/lib/audit";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const company = await getCompanySettings();
  const brandName = company.tradeName?.trim() || company.name?.trim() || "GestãoPro";
  const companyName = company.name?.trim() || brandName;

  return <LoginForm brandName={brandName} companyName={companyName} logoUrl={company.logoUrl} />;
}
