export type ModuleKey =
  | "vendas"
  | "os"
  | "clientes"
  | "produtos"
  | "estoque"
  | "compras"
  | "fornecedores"
  | "financeiro"
  | "funcionarios"
  | "relatorios"
  | "usuarios"
  | "auditoria"
  | "configuracoes";

export type ModuleInfo = {
  key: ModuleKey;
  label: string;
  href: string;
  section: "Comercial & Serviços" | "Suprimentos" | "Gestão & Sistema";
  description: string;
};

export const APP_MODULES: ModuleInfo[] = [
  // Comercial & Serviços
  {
    key: "vendas",
    label: "Vendas & PDV",
    href: "/vendas",
    section: "Comercial & Serviços",
    description: "Registrar orçamentos, vendas confirmadas e emitir recibos.",
  },
  {
    key: "os",
    label: "Ordens de Serviço",
    href: "/os",
    section: "Comercial & Serviços",
    description: "Abrir, acompanhar e concluir ordens de serviço na bancada.",
  },
  {
    key: "clientes",
    label: "Clientes",
    href: "/clientes",
    section: "Comercial & Serviços",
    description: "Cadastrar e consultar a carteira de clientes.",
  },
  // Suprimentos
  {
    key: "produtos",
    label: "Produtos",
    href: "/produtos",
    section: "Suprimentos",
    description: "Consultar catálogo, preços e cadastrar itens.",
  },
  {
    key: "estoque",
    label: "Estoque",
    href: " /estoque".trim(),
    section: "Suprimentos",
    description: "Controlar entradas, saídas, ajustes e saldos mínimos.",
  },
  {
    key: "compras",
    label: "Compras",
    href: "/compras",
    section: "Suprimentos",
    description: "Registrar pedidos de compra e recebimento de mercadorias.",
  },
  {
    key: "fornecedores",
    label: "Fornecedores",
    href: "/fornecedores",
    section: "Suprimentos",
    description: "Gerenciar cadastro e contatos de fornecedores.",
  },
  // Gestão & Sistema
  {
    key: "financeiro",
    label: "Financeiro",
    href: "/financeiro",
    section: "Gestão & Sistema",
    description: "Contas a pagar, a receber, baixas e fluxo de caixa.",
  },
  {
    key: "funcionarios",
    label: "Funcionários & RH",
    href: "/funcionarios",
    section: "Gestão & Sistema",
    description: "Cadastro de equipe, salários, acessos e geração de folha.",
  },
  {
    key: "relatorios",
    label: "Relatórios & DRE",
    href: "/relatorios",
    section: "Gestão & Sistema",
    description: "Demonstrativo de resultados (DRE), rankings e análises.",
  },
  {
    key: "usuarios",
    label: "Usuários do Sistema",
    href: "/usuarios",
    section: "Gestão & Sistema",
    description: "Gerenciar logins, senhas e permissões de acesso.",
  },
  {
    key: "auditoria",
    label: "Auditoria",
    href: "/auditoria",
    section: "Gestão & Sistema",
    description: "Histórico completo de ações realizadas no sistema.",
  },
  {
    key: "configuracoes",
    label: "Configurações",
    href: "/configuracoes",
    section: "Gestão & Sistema",
    description: "Dados cadastrais da empresa, CNPJ e rodapé de recibos.",
  },
];

export const ALL_MODULE_KEYS: ModuleKey[] = APP_MODULES.map((m) => m.key);

export const DEFAULT_EMPLOYEE_MODULES: ModuleKey[] = [
  "vendas",
  "os",
  "clientes",
  "produtos",
  "estoque",
  "compras",
  "fornecedores",
];

export const DEFAULT_PERMISSIONS_STRING = DEFAULT_EMPLOYEE_MODULES.join(",");

export const PERMISSION_PRESETS: { label: string; description: string; modules: ModuleKey[] }[] = [
  {
    label: "Vendedor / Balcão",
    description: "Vendas, Clientes e Produtos",
    modules: ["vendas", "clientes", "produtos"],
  },
  {
    label: "Técnico de OS",
    description: "Ordens de Serviço, Clientes, Produtos e Estoque",
    modules: ["os", "clientes", "produtos", "estoque"],
  },
  {
    label: "Estoquista / Compras",
    description: "Produtos, Estoque, Compras e Fornecedores",
    modules: ["produtos", "estoque", "compras", "fornecedores"],
  },
  {
    label: "Financeiro / Administrativo",
    description: "Financeiro, Relatórios, Vendas, Compras e Clientes",
    modules: ["financeiro", "relatorios", "vendas", "compras", "clientes"],
  },
  {
    label: "Operacional Completo",
    description: "Todos os módulos comerciais e de suprimentos",
    modules: DEFAULT_EMPLOYEE_MODULES,
  },
  {
    label: "Liberar Todos",
    description: "Acesso a todos os 13 módulos",
    modules: ALL_MODULE_KEYS,
  },
];

const VALID_SET = new Set<string>(ALL_MODULE_KEYS);

export function parsePermissions(raw: string | null | undefined, role?: string): ModuleKey[] {
  if (role === "ADMIN") return ALL_MODULE_KEYS;
  if (raw === "*") return ALL_MODULE_KEYS;
  if (raw === null || raw === undefined) return DEFAULT_EMPLOYEE_MODULES;
  if (raw.trim() === "") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ModuleKey => VALID_SET.has(s));
}

export function serializePermissions(keys: string[]): string {
  const unique = Array.from(new Set(keys.map((k) => k.trim()).filter((k) => VALID_SET.has(k))));
  return unique.join(",");
}

export function hasModuleAccess(
  session: { role: string; permissions?: string[] },
  moduleKey: ModuleKey,
): boolean {
  if (session.role === "ADMIN") return true;
  const perms = session.permissions ?? DEFAULT_EMPLOYEE_MODULES;
  return perms.includes(moduleKey);
}

export function canAccessPath(
  session: { role: string; permissions?: string[] },
  pathname: string,
): boolean {
  if (session.role === "ADMIN") return true;
  if (pathname === "/" || pathname === "/login" || pathname.startsWith("/perfil") || pathname.startsWith("/api")) {
    return true;
  }
  if (pathname === "/pdv" || pathname.startsWith("/pdv/") || pathname === "/nfe" || pathname.startsWith("/nfe/")) {
    return hasModuleAccess(session, "vendas");
  }
  if (pathname === "/producao" || pathname.startsWith("/producao/")) {
    return hasModuleAccess(session, "os");
  }
  if (pathname === "/recebimento" || pathname.startsWith("/recebimento/")) {
    return hasModuleAccess(session, "estoque");
  }
  const matched = APP_MODULES.find((m) => pathname === m.href || pathname.startsWith(m.href + "/"));
  if (!matched) return true;
  return hasModuleAccess(session, matched.key);
}
