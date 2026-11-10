"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Building2,
  Factory,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Moon,
  Package,
  PackageCheck,
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
  X,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/app/login/actions";
import type { SidebarAlerts } from "@/lib/audit";
import { hasModuleAccess, type ModuleKey } from "@/lib/permissions";
import type { Session } from "@/lib/token";
import { GlobalSearch } from "./GlobalSearch";
import { PwaInstallButton } from "./PwaManager";

type Item = {
  href: string;
  label: string;
  Icon: LucideIcon;
  moduleKey?: ModuleKey;
  alertKey?: keyof SidebarAlerts;
  subItem?: boolean;
};

const SECTIONS: { title: string; items: Item[] }[] = [
  { title: "Geral", items: [{ href: "/", label: "Dashboard", Icon: LayoutDashboard }] },
  {
    title: "Comercial & Serviços",
    items: [
      { href: "/vendas", label: "Vendas", Icon: ShoppingCart, moduleKey: "vendas" },
      { href: "/os", label: "Ordens de Serviço", Icon: Wrench, moduleKey: "os", alertKey: "os" },
      { href: "/producao", label: "Produção (OP)", Icon: Factory, moduleKey: "os" },
      { href: "/clientes", label: "Clientes", Icon: Users, moduleKey: "clientes" },
    ],
  },
  {
    title: "Suprimentos",
    items: [
      { href: "/produtos", label: "Produtos", Icon: Package, moduleKey: "produtos" },
      { href: "/estoque", label: "Estoque", Icon: Warehouse, moduleKey: "estoque", alertKey: "estoque" },
      { href: "/estoque/enderecamento", label: "Endereçamento", Icon: MapPin, moduleKey: "estoque", subItem: true },
      { href: "/recebimento", label: "Recebimento", Icon: PackageCheck, moduleKey: "estoque" },
      { href: "/compras", label: "Compras", Icon: Receipt, moduleKey: "compras" },
      { href: "/fornecedores", label: "Fornecedores", Icon: Truck, moduleKey: "fornecedores" },
    ],
  },
  {
    title: "Gestão & Sistema",
    items: [
      {
        href: "/financeiro",
        label: "Financeiro",
        Icon: Wallet,
        moduleKey: "financeiro",
        alertKey: "financeiro",
      },
      { href: "/funcionarios", label: "Funcionários", Icon: UserCheck, moduleKey: "funcionarios" },
      { href: "/relatorios", label: "Relatórios", Icon: BarChart3, moduleKey: "relatorios" },
      { href: "/usuarios", label: "Usuários", Icon: ShieldCheck, moduleKey: "usuarios" },
      { href: "/auditoria", label: "Auditoria", Icon: History, moduleKey: "auditoria" },
      { href: "/configuracoes", label: "Configurações", Icon: Settings, moduleKey: "configuracoes" },
    ],
  },
];

export function Sidebar({
  session,
  brandName = "GestãoPro",
  alerts,
}: {
  session: Session;
  brandName?: string;
  alerts?: SidebarAlerts;
}) {
  const pathname = usePathname();
  const isAdmin = session.role === "ADMIN";
  const [dark, setDark] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      setDark(true);
    }
  }, []);

  // Fecha o drawer ao mudar de rota no celular
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

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

  const allHrefs = SECTIONS.flatMap((s) => s.items.map((i) => i.href));
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (pathname === href) return true;
    if (pathname.startsWith(href + "/")) {
      const hasMoreSpecific = allHrefs.some(
        (other) =>
          other !== href &&
          other.startsWith(href) &&
          (pathname === other || pathname.startsWith(other + "/"))
      );
      return !hasMoreSpecific;
    }
    return false;
  };

  return (
    <>
      {/* Barra Superior Compacta (visível apenas no celular) */}
      <header className="mobile-topbar no-print">
        <div className="brand-left">
          <div className="logo">
            <Building2 size={17} strokeWidth={2.2} />
          </div>
          <span>{brandName}</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className="theme-btn"
            onClick={toggleTheme}
            title={dark ? "Modo claro" : "Modo escuro"}
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            type="button"
            className="theme-btn"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label="Abrir menu"
          >
            {drawerOpen ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </header>

      {/* Backdrop do Drawer no celular */}
      {drawerOpen && <div className="mobile-drawer-backdrop no-print" onClick={() => setDrawerOpen(false)} />}

      <aside className={`sidebar ${drawerOpen ? "mobile-open" : ""}`}>
        <div className="brand">
          <div className="brand-left">
            <div className="logo">
              <Building2 size={18} strokeWidth={2.2} />
            </div>
            <span>{brandName}</span>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button
              type="button"
              className="theme-btn"
              onClick={toggleTheme}
              title={dark ? "Alternar para modo claro (P&B)" : "Alternar para modo escuro (P&B)"}
            >
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>

        {/* Busca Global Instantânea (Ctrl + K) */}
        <div style={{ padding: "10px 12px 2px" }}>
          <GlobalSearch />
        </div>

        <nav>
          {SECTIONS.map((section) => {
            const items = section.items.filter((i) => !i.moduleKey || hasModuleAccess(session, i.moduleKey));
            if (items.length === 0) return null;
            return (
              <div key={section.title}>
                <div className="section">{section.title}</div>
                {items.map(({ href, label, Icon, alertKey, subItem }) => {
                  const count = alertKey && alerts ? alerts[alertKey] : 0;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`${isActive(href) ? "active" : ""} ${subItem ? "sidebar-subitem" : ""}`}
                      style={subItem ? { paddingLeft: 24, fontSize: 13, gap: 8 } : undefined}
                    >
                      <Icon size={subItem ? 14 : 17} strokeWidth={2} />
                      <span style={{ flex: 1 }}>{label}</span>
                      {count > 0 && <span className="sidebar-badge">{count}</span>}
                    </Link>
                  );
                })}
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
          <PwaInstallButton />
        </div>
      </aside>

      {/* Barra Fixa Inferior Estilo App Nativo (visível apenas no celular) */}
      <nav className="mobile-bottom-nav no-print">
        <Link href="/" className={`mobile-nav-item ${pathname === "/" ? "active" : ""}`}>
          <LayoutDashboard size={18} />
          <span>Início</span>
        </Link>
        {hasModuleAccess(session, "vendas") && (
          <Link href="/vendas" className={`mobile-nav-item ${pathname.startsWith("/vendas") ? "active" : ""}`}>
            <ShoppingCart size={18} />
            <span>Vendas</span>
          </Link>
        )}
        {hasModuleAccess(session, "os") && (
          <Link href="/os" className={`mobile-nav-item ${pathname.startsWith("/os") ? "active" : ""}`}>
            <Wrench size={18} />
            <span>OS {alerts && alerts.os > 0 ? `(${alerts.os})` : ""}</span>
          </Link>
        )}
        {hasModuleAccess(session, "estoque") && (
          <Link href="/estoque" className={`mobile-nav-item ${pathname.startsWith("/estoque") ? "active" : ""}`}>
            <Warehouse size={18} />
            <span>Estoque</span>
          </Link>
        )}
        <button
          type="button"
          className={`mobile-nav-item ${drawerOpen ? "active" : ""}`}
          onClick={() => setDrawerOpen((v) => !v)}
        >
          <Menu size={18} />
          <span>Menu</span>
        </button>
      </nav>
    </>
  );
}
