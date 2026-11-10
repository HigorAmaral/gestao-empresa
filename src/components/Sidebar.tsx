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
import { hasModuleAccess, type ModuleKey } from "@/lib/permissions";
import type { Session } from "@/lib/token";

type Item = { href: string; label: string; Icon: LucideIcon; moduleKey?: ModuleKey };

const SECTIONS: { title: string; items: Item[] }[] = [
  { title: "Geral", items: [{ href: "/", label: "Dashboard", Icon: LayoutDashboard }] },
  {
    title: "Comercial & Serviços",
    items: [
      { href: "/vendas", label: "Vendas", Icon: ShoppingCart, moduleKey: "vendas" },
      { href: "/os", label: "Ordens de Serviço", Icon: Wrench, moduleKey: "os" },
      { href: "/clientes", label: "Clientes", Icon: Users, moduleKey: "clientes" },
    ],
  },
  {
    title: "Suprimentos",
    items: [
      { href: "/produtos", label: "Produtos", Icon: Package, moduleKey: "produtos" },
      { href: "/estoque", label: "Estoque", Icon: Warehouse, moduleKey: "estoque" },
      { href: "/compras", label: "Compras", Icon: Receipt, moduleKey: "compras" },
      { href: "/fornecedores", label: "Fornecedores", Icon: Truck, moduleKey: "fornecedores" },
    ],
  },
  {
    title: "Gestão & Sistema",
    items: [
      { href: "/financeiro", label: "Financeiro", Icon: Wallet, moduleKey: "financeiro" },
      { href: "/funcionarios", label: "Funcionários", Icon: UserCheck, moduleKey: "funcionarios" },
      { href: "/relatorios", label: "Relatórios", Icon: BarChart3, moduleKey: "relatorios" },
      { href: "/usuarios", label: "Usuários", Icon: ShieldCheck, moduleKey: "usuarios" },
      { href: "/auditoria", label: "Auditoria", Icon: History, moduleKey: "auditoria" },
      { href: "/configuracoes", label: "Configurações", Icon: Settings, moduleKey: "configuracoes" },
    ],
  },
];

export function Sidebar({ session, brandName = "GestãoPro" }: { session: Session; brandName?: string }) {
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
          <span>{brandName}</span>
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
          const items = section.items.filter((i) => !i.moduleKey || hasModuleAccess(session, i.moduleKey));
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
