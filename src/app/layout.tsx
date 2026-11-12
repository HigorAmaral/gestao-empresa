import type { Metadata, Viewport } from "next";
import { getCompanySettings } from "@/lib/audit";
import { PwaServiceWorker } from "@/components/PwaManager";
import { DynamicThemeStyles } from "@/components/DynamicThemeStyles";
import { AccessibilityInitializer } from "@/components/AccessibilityManager";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const company = await getCompanySettings().catch(() => null);
  const brand = company?.tradeName?.trim() || company?.name?.trim() || "GestãoPro";
  return {
    title: {
      default: `${brand} — Sistema de Gerenciamento Empresarial`,
      template: `%s | ${brand}`,
    },
    description: "Clientes, fornecedores, estoque, vendas, compras, OS, financeiro e RH em um só lugar.",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: brand,
    },
    formatDetection: {
      telephone: false,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const company = await getCompanySettings().catch(() => null);

  return (
    <html lang="pt-BR">
      <head>
        <DynamicThemeStyles
          primaryColor={company?.primaryColor}
          sidebarColor={company?.sidebarColor}
          accentColor={company?.accentColor}
        />
      </head>
      <body>
        <AccessibilityInitializer />
        <PwaServiceWorker />
        {children}
      </body>
    </html>
  );
}
