import type { MetadataRoute } from "next";
import { getCompanySettings } from "@/lib/audit";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let brandName = "GestãoPro";
  try {
    const company = await getCompanySettings();
    brandName = company.tradeName?.trim() || company.name?.trim() || "GestãoPro";
  } catch {
    // Fallback padrão caso banco não esteja acessível no build estático
  }

  return {
    name: `${brandName} — Sistema de Gestão Empresarial`,
    short_name: brandName,
    description: "ERP Completo: Vendas, OS, Estoque, Compras, Financeiro, DRE e RH.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    orientation: "any",
    icons: [
      {
        src: "/api/pwa-icon?size=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/pwa-icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/pwa-icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
