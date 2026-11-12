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
  | "configuracoes"
  | "qualidade"
  | "ti";

export type Role =
  | "ADMIN"
  | "SUPORTE"
  | "SUPRIMENTOS"
  | "QUALIDADE"
  | "VENDEDOR"
  | "TECNICO_OS"
  | "FINANCEIRO"
  | "RH"
  | "FUNCIONARIO";

export type ModuleInfo = {
  key: ModuleKey;
  label: string;
  href: string;
  section:
    | "Comercial & Serviços"
    | "Suprimentos"
    | "Qualidade (SGQ)"
    | "Gestão & Sistema"
    | "Tecnologia & TI";
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
    label: "Estoque & Recebimento",
    href: "/estoque",
    section: "Suprimentos",
    description: "Controlar almoxarifado, endereçamento, inventário e recebimento de mercadorias.",
  },
  {
    key: "compras",
    label: "Compras",
    href: "/compras",
    section: "Suprimentos",
    description: "Registrar pedidos de compra e reposição de suprimentos.",
  },
  {
    key: "fornecedores",
    label: "Fornecedores",
    href: "/fornecedores",
    section: "Suprimentos",
    description: "Gerenciar cadastro e contatos de fornecedores.",
  },
  // Qualidade (SGQ)
  {
    key: "qualidade",
    label: "Qualidade (SGQ)",
    href: "/qualidade",
    section: "Qualidade (SGQ)",
    description: "Inspeções de qualidade, checklists de lote e Não Conformidades (RNC/CAPA).",
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
  // Tecnologia & TI (Área Reservada)
  {
    key: "ti",
    label: "Departamento de TI",
    href: "/suporte-ti",
    section: "Tecnologia & TI",
    description: "Helpdesk corporativo, inventário de ativos, procedimentos e monitoramento de infraestrutura.",
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

export type RoleDefinition = {
  key: Role;
  label: string;
  shortLabel: string;
  description: string;
  defaultDepartment: string;
  modules: ModuleKey[];
};

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    key: "SUPORTE",
    label: "Suporte (TI & Infraestrutura)",
    shortLabel: "Suporte (TI)",
    description: "Acesso completo à Central de TI, ativos, segurança WAF, usuários e auditoria.",
    defaultDepartment: "Tecnologia da Informação (TI)",
    modules: ["ti", "usuarios", "auditoria"],
  },
  {
    key: "SUPRIMENTOS",
    label: "Suprimentos (Almoxarifado & Recebimento)",
    shortLabel: "Suprimentos",
    description: "Almoxarifado, endereçamento, inventário físico, recebimento de mercadorias, compras, produtos e fornecedores.",
    defaultDepartment: "Suprimentos / Almoxarifado",
    modules: ["estoque", "compras", "produtos", "fornecedores"],
  },
  {
    key: "QUALIDADE",
    label: "Qualidade (SGQ)",
    shortLabel: "Qualidade (SGQ)",
    description: "Área da Qualidade: inspeções de recebimento/produção, RNCs, CAPA, produtos e estoque.",
    defaultDepartment: "Qualidade (SGQ)",
    modules: ["qualidade", "produtos", "estoque", "os"],
  },
  {
    key: "VENDEDOR",
    label: "Vendedor / Comercial & PDV",
    shortLabel: "Vendedor",
    description: "PDV, vendas, funil CRM, clientes e consulta de produtos.",
    defaultDepartment: "Comercial / Vendas",
    modules: ["vendas", "clientes", "produtos"],
  },
  {
    key: "TECNICO_OS",
    label: "Técnico de OS & Produção",
    shortLabel: "Técnico OS",
    description: "Ordens de serviço, ordens de produção, clientes, produtos e estoque.",
    defaultDepartment: "Operações / Assistência Técnica",
    modules: ["os", "clientes", "produtos", "estoque"],
  },
  {
    key: "FINANCEIRO",
    label: "Financeiro / Administrativo",
    shortLabel: "Financeiro",
    description: "Financeiro, conciliação OFX, relatórios/DRE, compras, vendas e clientes.",
    defaultDepartment: "Financeiro / Administrativo",
    modules: ["financeiro", "relatorios", "vendas", "compras", "clientes"],
  },
  {
    key: "RH",
    label: "RH / Departamento Pessoal",
    shortLabel: "RH",
    description: "Prontuários, folha de pagamento, ponto REP, férias, SST e relatórios.",
    defaultDepartment: "Recursos Humanos",
    modules: ["funcionarios", "relatorios"],
  },
  {
    key: "FUNCIONARIO",
    label: "Funcionário (Personalizado)",
    shortLabel: "Funcionário",
    description: "Acesso operacional padrão ou customizado manualmente por módulo.",
    defaultDepartment: "",
    modules: DEFAULT_EMPLOYEE_MODULES,
  },
  {
    key: "ADMIN",
    label: "Administrador (Acesso Total)",
    shortLabel: "Administrador",
    description: "Acesso irrestrito a todos os módulos e configurações do sistema.",
    defaultDepartment: "Diretoria / Administração",
    modules: ALL_MODULE_KEYS,
  },
];

const ROLE_BY_KEY = new Map<string, RoleDefinition>(ROLE_DEFINITIONS.map((r) => [r.key, r]));

export function normalizeRole(raw?: string | null): Role {
  const key = (raw || "").trim().toUpperCase();
  if (ROLE_BY_KEY.has(key)) return key as Role;
  return "FUNCIONARIO";
}

export function getRoleDefinition(role?: string | null): RoleDefinition {
  return ROLE_BY_KEY.get(normalizeRole(role)) ?? ROLE_BY_KEY.get("FUNCIONARIO")!;
}

export const PERMISSION_PRESETS: {
  role: Role;
  label: string;
  description: string;
  modules: ModuleKey[];
}[] = ROLE_DEFINITIONS.filter((r) => r.key !== "FUNCIONARIO" && r.key !== "ADMIN").map((r) => ({
  role: r.key,
  label: r.shortLabel,
  description: r.description,
  modules: r.modules,
}));

const VALID_SET = new Set<string>(ALL_MODULE_KEYS);

export function parsePermissions(raw: string | null | undefined, role?: string): ModuleKey[] {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "ADMIN") return ALL_MODULE_KEYS;
  if (raw === "*") return ALL_MODULE_KEYS;
  if (raw === null || raw === undefined) return getRoleDefinition(normalizedRole).modules;
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
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/perfil") ||
    pathname.startsWith("/api")
  ) {
    return true;
  }
  if (pathname === "/suporte-ti" || pathname.startsWith("/suporte-ti/")) {
    return hasModuleAccess(session, "ti");
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
