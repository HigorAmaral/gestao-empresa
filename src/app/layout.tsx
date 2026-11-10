import type { Metadata, Viewport } from "next";
import { PwaServiceWorker } from "@/components/PwaManager";
import "./globals.css";

export const metadata: Metadata = {
  title: "GestãoPro — Sistema de Gerenciamento Empresarial",
  description: "Clientes, fornecedores, estoque, vendas, compras, OS, financeiro e RH em um só lugar.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GestãoPro",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <PwaServiceWorker />
        {children}
      </body>
    </html>
  );
}
