"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Award,
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  ChevronRight,
  ClipboardCheck,
  Cpu,
  Factory,
  FileText,
  FileSpreadsheet,
  Headphones,
  HeartPulse,
  History,
  Laptop,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Monitor,
  Moon,
  Package,
  PackageCheck,
  PanelLeftClose,
  Receipt,
  Search,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Sun,
  TrendingUp,
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
import { NotificationsCenter } from "./NotificationsCenter";
import { AccessibilityQuickButton } from "./AccessibilityManager";
import type { AppNotification } from "@/lib/notifications";

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
      { href: "/pdv", label: "PDV (Frente de Caixa)", Icon: Monitor, moduleKey: "vendas" },
      { href: "/vendas", label: "Vendas", Icon: ShoppingCart, moduleKey: "vendas" },
      { href: "/vendas/funil", label: "Funil & CRM", Icon: TrendingUp, moduleKey: "vendas", subItem: true },
      { href: "/contratos", label: "Contratos & Recorrência", Icon: FileSpreadsheet, moduleKey: "vendas" },
      { href: "/nfe", label: "Notas Fiscais (NF-e)", Icon: FileText, moduleKey: "vendas" },
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
      { href: "/estoque/inventario", label: "Inventário Físico", Icon: ClipboardCheck, moduleKey: "estoque", subItem: true },
      { href: "/recebimento", label: "Recebimento", Icon: PackageCheck, moduleKey: "estoque" },
      { href: "/compras", label: "Compras", Icon: Receipt, moduleKey: "compras" },
      { href: "/fornecedores", label: "Fornecedores", Icon: Truck, moduleKey: "fornecedores" },
      { href: "/qualidade", label: "Qualidade (SGQ)", Icon: Award, moduleKey: "qualidade", alertKey: "qualidade" },
    ],
  },
  {
    title: "RH & Depto. Pessoal",
    items: [
      { href: "/funcionarios", label: "Equipe & Prontuários", Icon: UserCheck, moduleKey: "funcionarios" },
      { href: "/portal-colaborador", label: "Portal do Colaborador", Icon: UserCheck, moduleKey: "funcionarios", subItem: true },
      { href: "/funcionarios/folha", label: "Folha de Pagamento", Icon: Receipt, moduleKey: "funcionarios" },
      { href: "/funcionarios/ponto", label: "Relógio de Ponto (REP)", Icon: Cpu, moduleKey: "funcionarios" },
      { href: "/funcionarios/ferias", label: "Férias & Atestados", Icon: Calendar, moduleKey: "funcionarios" },
      { href: "/funcionarios/sst", label: "EPIs & Exames (SST)", Icon: HeartPulse, moduleKey: "funcionarios" },
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
      { href: "/relatorios", label: "Relatórios", Icon: BarChart3, moduleKey: "relatorios" },
      { href: "/usuarios", label: "Usuários", Icon: ShieldCheck, moduleKey: "usuarios" },
      { href: "/auditoria", label: "Auditoria", Icon: History, moduleKey: "auditoria" },
      { href: "/configuracoes", label: "Configurações", Icon: Settings, moduleKey: "configuracoes" },
    ],
  },
  {
    title: "Tecnologia & TI (Reservado)",
    items: [
      { href: "/suporte-ti", label: "Central de Chamados TI", Icon: Headphones, moduleKey: "ti" },
      { href: "/suporte-ti?tab=seguranca", label: "Segurança & WAF", Icon: ShieldAlert, moduleKey: "ti", subItem: true },
      { href: "/suporte-ti?tab=ativos", label: "Inventário de Ativos", Icon: Laptop, moduleKey: "ti", subItem: true },
      { href: "/suporte-ti?tab=infra", label: "Saúde & Infraestrutura", Icon: Server, moduleKey: "ti", subItem: true },
      { href: "/suporte-ti?tab=kb", label: "Base de Conhecimento", Icon: BookOpen, moduleKey: "ti", subItem: true },
    ],
  },
];

export function Sidebar({
  session,
  brandName = "GestãoPro",
  logoUrl,
  alerts,
  notifications = [],
}: {
  session: Session;
  brandName?: string;
  logoUrl?: string | null;
  alerts?: SidebarAlerts;
  notifications?: AppNotification[];
}) {
  const pathname = usePathname();
  const isAdmin = session.role === "ADMIN";
  const [dark, setDark] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      setDark(true);
    }
    const savedCollapsed = localStorage.getItem("sidebar_collapsed");
    if (savedCollapsed === "true" && window.innerWidth > 800) {
      setCollapsed(true);
      document.body.classList.add("sidebar-collapsed");
    }
  }, []);

  // Fecha o drawer ao mudar de rota no celular ou pressionar Escape
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

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

  function handleCollapse() {
    if (typeof window !== "undefined" && window.innerWidth <= 800) {
      setDrawerOpen(false);
      return;
    }
    const next = !collapsed;
    setCollapsed(next);
    if (next) {
      document.body.classList.add("sidebar-collapsed");
      localStorage.setItem("sidebar_collapsed", "true");
    } else {
      document.body.classList.remove("sidebar-collapsed");
      localStorage.setItem("sidebar_collapsed", "false");
    }
  }

  function handleExpand() {
    if (typeof window !== "undefined" && window.innerWidth <= 800) {
      setDrawerOpen(true);
      return;
    }
    setCollapsed(false);
    document.body.classList.remove("sidebar-collapsed");
    localStorage.setItem("sidebar_collapsed", "false");
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
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={brandName}
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "#ffffff",
                objectFit: "contain",
                padding: 2,
                flexShrink: 0,
              }}
            />
          ) : (
            <div className="logo" style={{ width: 34, height: 34 }}>
              <Building2 size={18} strokeWidth={2.2} />
            </div>
          )}
          <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {brandName}
          </span>
        </div>
        <div className="brand-actions" style={{ gap: 6 }}>
          <NotificationsCenter notifications={notifications} />
          <AccessibilityQuickButton />
          <button
            type="button"
            className="theme-btn"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
              }
            }}
            title="Buscar (Ctrl+K)"
            aria-label="Pesquisar"
          >
            <Search size={14} />
          </button>
          <button
            type="button"
            className="theme-btn"
            onClick={toggleTheme}
            title={dark ? "Modo claro" : "Modo escuro"}
            aria-label={dark ? "Alternar para modo claro" : "Alternar para modo escuro"}
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            type="button"
            className="theme-btn"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label={drawerOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={drawerOpen}
          >
            {drawerOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </header>

      {/* Backdrop do Drawer no celular */}
      {drawerOpen && <div className="mobile-drawer-backdrop no-print" onClick={() => setDrawerOpen(false)} />}

      <aside className={`sidebar ${drawerOpen ? "mobile-open" : ""}`}>
        <div className="brand">
          <div className="brand-left">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={brandName}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: "#ffffff",
                  objectFit: "contain",
                  padding: 2,
                  flexShrink: 0,
                }}
              />
            ) : (
              <div className="logo" style={{ width: 34, height: 34 }}>
                <Building2 size={18} strokeWidth={2.2} />
              </div>
            )}
            <span className="brand-title" title={brandName}>
              {brandName}
            </span>
          </div>
          <div className="brand-actions">
            <NotificationsCenter notifications={notifications} />
            <AccessibilityQuickButton />
            <button
              type="button"
              className="theme-btn"
              onClick={toggleTheme}
              aria-label={dark ? "Alternar para modo claro" : "Alternar para modo escuro"}
              title={dark ? "Alternar para modo claro (P&B)" : "Alternar para modo escuro (P&B)"}
            >
              {dark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              type="button"
              className="theme-btn sidebar-close-btn"
              onClick={() => {
                if (drawerOpen) setDrawerOpen(false);
                else handleCollapse();
              }}
              aria-label={drawerOpen ? "Fechar menu lateral" : "Recolher menu lateral"}
              title={drawerOpen ? "Fechar menu lateral" : "Recolher menu lateral"}
            >
              {drawerOpen ? <X size={15} /> : <PanelLeftClose size={15} />}
            </button>
          </div>
        </div>

        {/* Busca Global Instantânea (Ctrl + K) */}
        <div style={{ padding: "10px 12px 2px" }}>
          <GlobalSearch />
        </div>

        <nav
          aria-label="Menu principal"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) {
              setDrawerOpen(false);
            }
          }}
        >
          {SECTIONS.map((section) => {
            const items = section.items.filter((i) => !i.moduleKey || hasModuleAccess(session, i.moduleKey));
            if (items.length === 0) return null;
            return (
              <div key={section.title}>
                <div className="section">{section.title}</div>
                {items.map(({ href, label, Icon, alertKey, subItem }) => {
                  const count = alertKey && alerts ? alerts[alertKey] : 0;
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={`${active ? "active" : ""} ${subItem ? "sidebar-subitem" : ""}`}
                    >
                      <Icon size={subItem ? 14 : 17} strokeWidth={2} aria-hidden="true" />
                      <span style={{ flex: 1 }}>{label}</span>
                      {count > 0 && (
                        <span className="sidebar-badge" aria-label={`${count} pendência(s)`}>
                          {count}
                        </span>
                      )}
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

      {/* Seta no meio da lateral para reabrir / expandir a barra */}
      {collapsed && (
        <button
          type="button"
          className="sidebar-expand-tab no-print"
          onClick={handleExpand}
          title="Expandir menu lateral"
          aria-label="Expandir menu lateral"
        >
          <ChevronRight size={18} strokeWidth={2.5} />
        </button>
      )}

      {/* Barra Fixa Inferior Estilo App Nativo (visível apenas no celular) */}
      <nav className="mobile-bottom-nav no-print" aria-label="Navegação rápida">
        <Link
          href="/"
          aria-current={pathname === "/" ? "page" : undefined}
          className={`mobile-nav-item ${pathname === "/" ? "active" : ""}`}
        >
          <LayoutDashboard size={18} aria-hidden="true" />
          <span>Início</span>
        </Link>
        {hasModuleAccess(session, "vendas") && (
          <Link
            href="/vendas"
            aria-current={pathname.startsWith("/vendas") ? "page" : undefined}
            className={`mobile-nav-item ${pathname.startsWith("/vendas") ? "active" : ""}`}
          >
            <ShoppingCart size={18} aria-hidden="true" />
            <span>Vendas</span>
          </Link>
        )}
        {hasModuleAccess(session, "os") && (
          <Link
            href="/os"
            aria-current={pathname.startsWith("/os") ? "page" : undefined}
            className={`mobile-nav-item ${pathname.startsWith("/os") ? "active" : ""}`}
          >
            <Wrench size={18} aria-hidden="true" />
            <span>OS {alerts && alerts.os > 0 ? `(${alerts.os})` : ""}</span>
          </Link>
        )}
        {hasModuleAccess(session, "estoque") && (
          <Link
            href="/estoque"
            aria-current={pathname.startsWith("/estoque") ? "page" : undefined}
            className={`mobile-nav-item ${pathname.startsWith("/estoque") ? "active" : ""}`}
          >
            <Warehouse size={18} aria-hidden="true" />
            <span>Estoque</span>
          </Link>
        )}
        <button
          type="button"
          className={`mobile-nav-item ${drawerOpen ? "active" : ""}`}
          onClick={() => setDrawerOpen((v) => !v)}
          aria-expanded={drawerOpen}
          aria-label={drawerOpen ? "Fechar menu completo" : "Abrir menu completo"}
        >
          <Menu size={18} aria-hidden="true" />
          <span>Menu</span>
        </button>
      </nav>
    </>
  );
}
