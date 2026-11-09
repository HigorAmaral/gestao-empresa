import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GestãoPro — Sistema de Gerenciamento Empresarial",
  description: "Clientes, fornecedores, estoque, vendas, compras, financeiro e RH em um só lugar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
