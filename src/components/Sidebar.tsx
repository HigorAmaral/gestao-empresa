"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Building2,
  History,
  LayoutDashboard,
  LogOut,
  Moon,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sun,
  Truck,
  User,
  UserCheck,
  Users,
  Wallet,
  Warehouse,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/app/login/actions";
import type { Session } from "@/lib/token";

type Item = { href: string; label: string; Icon: LucideIcon; admin?: boolean };

const SECTIONS: { title: string; items: Item[] }[] = [
  { title: "Geral", items: [{ href: "/", label: "Dashboard", Icon: LayoutDashboard }] },
  {
    title: "Comercial & Serviços",
    items: [
      { href: "/vendas", label: "Vendas", Icon: ShoppingCart },
      { href: "/os", label: "Ordens de Serviço", Icon: Wrench },
      { href: "/clientes", label: "Clientes", Icon: Users },
    ],
  },
  {
    title: "Suprimentos",
    items: [
      { href: "/produtos", label: "Produtos", Icon: Package },
      { href: "/estoque", label: "Estoque", Icon: Warehouse },
      { href: "/compras", label: "Compras", Icon: Receipt },
      { href: "/fornecedores", label: "Fornecedores", Icon: Truck },
    ],
  },
  {
    title: "Gestão & Sistema",
    items: [
      { href: "/financeiro", label: "Financeiro", Icon: Wallet, admin: true },
      { href: "/funcionarios", label: "Funcionários", Icon: UserCheck, admin: true },
      { href: "/relatorios", label: "Relatórios", Icon: BarChart3, admin: true },
      { href: "/usuarios", label: "Usuários", Icon: ShieldCheck, admin: true },
      { href: "/auditoria", label: "Auditoria", Icon: History, admin: true },
      { href: "/configuracoes", label: "Configurações", Icon: Settings, admin: true },
    ],
  },
];

export function Sidebar({ session }: { session: Session }) {
  const pathname = usePathname();
  const isAdmin = session.role === "ADMIN";
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      setDark(true);
    }
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("theme", "light");
    }
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-left">
          <div className="logo">
            <Building2 size={18} strokeWidth={2.2} />
          </div>
          <span>GestãoPro</span>
        </div>
        <button
          type="button"
          className="theme-btn"
          onClick={toggleTheme}
          title={dark ? "Alternar para modo claro (P&B)" : "Alternar para modo escuro (P&B)"}
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
      <nav>
        {SECTIONS.map((section) => {
          const items = section.items.filter((i) => !i.admin || isAdmin);
          if (items.length === 0) return null;
          return (
            <div key={section.title}>
              <div className="section">{section.title}</div>
              {items.map(({ href, label, Icon }) => (
                <Link key={href} href={href} className={isActive(href) ? "active" : ""}>
                  <Icon size={17} strokeWidth={2} />
                  {label}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>
      <div className="userbox">
        <div className="name">{session.name}</div>
        <div className="role">{isAdmin ? "Administrador" : "Funcionário"}</div>
        <div className="links">
          <Link href="/perfil">
            <User size={13} /> Meu perfil
          </Link>
          <form action={logout}>
            <button type="submit">
              <LogOut size={13} /> Sair
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
