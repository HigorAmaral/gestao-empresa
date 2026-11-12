// ==========================================
// REGRAS & ASSINATURAS DO WAF (Web Application Firewall)
// 100% Edge-Compatible (zero dependências Node.js/Prisma)
// ==========================================

export const SQL_INJECTION_PATTERNS = [
  /\b(union([\s\+]+all)?[\s\+]+select|select[\s\+]+.+[\s\+]+from|drop[\s\+]+table|alter[\s\+]+table|insert[\s\+]+into|update[\s\+]+.+[\s\+]+set|delete[\s\+]+from)\b/i,
  /\b(exec(\s|\+)+(s|x)p_|xp_cmdshell|sp_executesql)\b/i,
  /(\b(or|and)\b[\s\+]+['"]?[a-zA-Z0-9]+['"]?[\s\+]*[=<>!]+[\s\+]*['"]?[a-zA-Z0-9]+['"]?)/i,
  /(\bwaitfor\s+delay\b|\bbenchmark\s*\(|\bsleep\s*\(|\bpg_sleep\s*\()/i,
  /(--|\/\*|\*\/|@@version|0x[0-9a-fA-F]{4,})/i,
];

export const XSS_PATTERNS = [
  /<script[\s\S]*?>[\s\S]*?<\/script>/i,
  /javascript\s*:/i,
  /data:text\/html/i,
  /vbscript\s*:/i,
  /on(error|load|click|mouseover|focus|blur|submit|mouseenter|mouseleave)\s*=/i,
  /<(iframe|object|embed|applet|meta|link|base)[\s\S]*?>/i,
  /<svg[\s\S]*?onload[\s\S]*?>/i,
  /document\.(cookie|location|write)/i,
  /window\.(location|open)/i,
  /eval\s*\(|Function\s*\(/i,
];

export const PATH_TRAVERSAL_PATTERNS = [
  /(\.\.[\/\\]|%2e%2e[\/\\]|\.\.%2f|\.\.%5c)/i,
  /\/etc\/(passwd|shadow|hosts|issue)/i,
  /(c:\\windows|c:\\boot\.ini|win\.ini)/i,
  /\b(\.env|\.git|\.aws|\.ssh|\.htpasswd|\.htaccess)\b/i,
];

export const COMMAND_INJECTION_PATTERNS = [
  /(\||;|&|`|\$\()\s*(nc|netcat|ncat|bash|sh|zsh|cmd\.exe|powershell|curl|wget)\b/i,
  /\/bin\/(sh|bash|zsh)/i,
];

export const SCANNER_BOT_PATTERNS = [
  /(sqlmap|nikto|acunetix|dirbuster|nmap|masscan|wpscan|gobuster|censys|shodan|zgrab|arachni|nessus|qualys|metasploit|burpcollaborator)/i,
];

export const SUSPICIOUS_PROBE_PATHS = [
  /^\/(\.env|\.git|\.aws|wp-login\.php|wp-admin|phpmyadmin|pma|shell\.php|cmd\.php|solr|actuator|xmlrpc\.php|cgi-bin|boaform|alfa-rex)/i,
];

// ==========================================
// RATE LIMITER EM MEMÓRIA
// ==========================================

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const memoryRateLimit = new Map<string, RateLimitBucket>();

export function checkRateLimit(
  ip: string,
  category: "GENERAL" | "AUTH" = "GENERAL",
  maxRequests: number = 100,
  windowSeconds: number = 60
): { allowed: boolean; remaining: number; resetInSec: number } {
  const key = `${category}:${ip}`;
  const now = Date.now();
  const bucket = memoryRateLimit.get(key);

  if (!bucket || now > bucket.resetAt) {
    memoryRateLimit.set(key, {
      count: 1,
      resetAt: now + windowSeconds * 1000,
    });
    return { allowed: true, remaining: maxRequests - 1, resetInSec: windowSeconds };
  }

  bucket.count++;
  const remaining = Math.max(0, maxRequests - bucket.count);
  const resetInSec = Math.max(1, Math.round((bucket.resetAt - now) / 1000));

  if (bucket.count > maxRequests) {
    return { allowed: false, remaining: 0, resetInSec };
  }

  return { allowed: true, remaining, resetInSec };
}

// ==========================================
// INSPEÇÃO DE SEGURANÇA DO WAF
// ==========================================

export interface SecurityInspectionResult {
  blocked: boolean;
  eventType?:
    | "SQL_INJECTION"
    | "XSS_ATTEMPT"
    | "PATH_TRAVERSAL"
    | "SCANNER_BOT"
    | "COMMAND_INJECTION"
    | "PROBE_ATTACK"
    | "RATE_LIMIT";
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason?: string;
  details?: string;
}

export function inspectRequest(
  pathname: string,
  search: string,
  userAgent: string = ""
): SecurityInspectionResult {
  // 1. Scanner Malicioso / Bot de Vulnerabilidades
  for (const pattern of SCANNER_BOT_PATTERNS) {
    if (pattern.test(userAgent)) {
      return {
        blocked: true,
        eventType: "SCANNER_BOT",
        severity: "CRITICAL",
        reason: "Scanner Malicioso Detectado",
        details: `Ferramenta de varredura automatizada detectada no User-Agent.`,
      };
    }
  }

  // 2. Sondagem de Arquivos Sensíveis & Portais Vulneráveis (Probe)
  for (const pattern of SUSPICIOUS_PROBE_PATHS) {
    if (pattern.test(pathname)) {
      return {
        blocked: true,
        eventType: "PROBE_ATTACK",
        severity: "HIGH",
        reason: "Sondagem / Exploit de Arquivo Sensível",
        details: `Tentativa de acesso a rota proibida: "${pathname}"`,
      };
    }
  }

  const payload = decodeURIComponentSafely(`${pathname}?${search}`);

  // 3. Path Traversal & LFI
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(payload)) {
      return {
        blocked: true,
        eventType: "PATH_TRAVERSAL",
        severity: "CRITICAL",
        reason: "Ataque de Diretório / Path Traversal Detectado",
        details: `Caminho suspeito de exploração local: "${payload.slice(0, 100)}"`,
      };
    }
  }

  // 4. Injeção de Comando de Sistema Operacional (RCE)
  for (const pattern of COMMAND_INJECTION_PATTERNS) {
    if (pattern.test(payload)) {
      return {
        blocked: true,
        eventType: "COMMAND_INJECTION",
        severity: "CRITICAL",
        reason: "Tentativa de Injeção de Comando (RCE)",
        details: `Padrão de execução de shell interceptado: "${payload.slice(0, 100)}"`,
      };
    }
  }

  // 5. Injeção SQL (SQLi)
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(payload)) {
      return {
        blocked: true,
        eventType: "SQL_INJECTION",
        severity: "CRITICAL",
        reason: "Tentativa de Injeção SQL (SQLi)",
        details: `Sintaxe SQL maliciosa detectada nos parâmetros: "${payload.slice(0, 100)}"`,
      };
    }
  }

  // 6. Cross-Site Scripting (XSS)
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(payload)) {
      return {
        blocked: true,
        eventType: "XSS_ATTEMPT",
        severity: "HIGH",
        reason: "Tentativa de Cross-Site Scripting (XSS)",
        details: `Tag ou script malicioso interceptado: "${payload.slice(0, 100)}"`,
      };
    }
  }

  return { blocked: false };
}

function decodeURIComponentSafely(uri: string): string {
  try {
    return decodeURIComponent(uri);
  } catch {
    return uri;
  }
}

// ==========================================
// CABEÇALHOS DE SEGURANÇA
// ==========================================

export function getSecurityHeaders(): Record<string, string> {
  return {
    "X-Frame-Options": "SAMEORIGIN",
    "X-Content-Type-Options": "nosniff",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'self';",
  };
}

export function applySecurityHeaders(headers: Headers): void {
  const sec = getSecurityHeaders();
  for (const [key, value] of Object.entries(sec)) {
    headers.set(key, value);
  }
}
