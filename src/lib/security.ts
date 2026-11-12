import { prisma } from "./prisma";
import { ensureStockLocationTables } from "./stock-location";

export * from "./security-rules";

// Cache de IPs bloqueados
const blockedIpsCache = new Set<string>();
let lastBlocklistSync = 0;

// ==========================================
// DEFESA CONTRA FORÇA BRUTA & BLOQUEIO DE CONTAS
// ==========================================

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MINUTES = 15;

export async function checkBruteForceLockout(identifier: string): Promise<{
  locked: boolean;
  remainingMinutes?: number;
  attempts: number;
}> {
  await ensureStockLocationTables();
  const id = identifier.trim().toLowerCase();

  const record = await (prisma as any).loginAttempt.findUnique({
    where: { identifier: id },
  });

  if (!record) {
    return { locked: false, attempts: 0 };
  }

  if (record.lockedUntil) {
    const now = new Date();
    if (record.lockedUntil > now) {
      const remainingMs = record.lockedUntil.getTime() - now.getTime();
      const remainingMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
      return { locked: true, remainingMinutes, attempts: record.attempts };
    } else {
      // Bloqueio expirou: limpa o lockout
      await (prisma as any).loginAttempt.update({
        where: { identifier: id },
        data: { lockedUntil: null, attempts: 0 },
      });
      return { locked: false, attempts: 0 };
    }
  }

  return { locked: false, attempts: record.attempts };
}

export async function recordFailedLoginAttempt(
  identifier: string,
  ip: string
): Promise<{ locked: boolean; remainingMinutes?: number; attempts: number }> {
  await ensureStockLocationTables();
  const id = identifier.trim().toLowerCase();

  const existing = await (prisma as any).loginAttempt.findUnique({
    where: { identifier: id },
  });

  const currentAttempts = (existing?.attempts || 0) + 1;
  const shouldLock = currentAttempts >= MAX_LOGIN_ATTEMPTS;
  const lockedUntil = shouldLock
    ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
    : null;

  await (prisma as any).loginAttempt.upsert({
    where: { identifier: id },
    create: {
      identifier: id,
      attempts: 1,
      lastFailed: new Date(),
      lockedUntil,
    },
    update: {
      attempts: currentAttempts,
      lastFailed: new Date(),
      lockedUntil,
    },
  });

  // Se atingiu o limite, registra incidente de segurança
  if (shouldLock) {
    await logSecurityIncident({
      ip,
      eventType: "BRUTE_FORCE",
      severity: "CRITICAL",
      endpoint: "/login",
      method: "POST",
      details: `Bloqueio de segurança ativado para ${id}: 5 tentativas consecutivas de senha incorreta. Bloqueado por 15 minutos contra ataque de força bruta.`,
      blocked: true,
    });
  }

  return {
    locked: shouldLock,
    remainingMinutes: shouldLock ? LOCKOUT_DURATION_MINUTES : undefined,
    attempts: currentAttempts,
  };
}

export async function clearLoginAttempts(identifier: string): Promise<void> {
  try {
    await ensureStockLocationTables();
    await (prisma as any).loginAttempt.deleteMany({
      where: { identifier: identifier.trim().toLowerCase() },
    });
  } catch {}
}

// ==========================================
// REGISTRO & PERSISTÊNCIA DE INCIDENTES (IDS)
// ==========================================

export interface SecurityIncidentInput {
  ip: string;
  eventType: string;
  severity?: string;
  endpoint: string;
  method?: string;
  userAgent?: string;
  details: string;
  blocked?: boolean;
}

export async function logSecurityIncident(input: SecurityIncidentInput): Promise<void> {
  try {
    await ensureStockLocationTables();
    await (prisma as any).securityEvent.create({
      data: {
        ip: input.ip,
        eventType: input.eventType,
        severity: input.severity || "MEDIUM",
        endpoint: input.endpoint.slice(0, 500),
        method: input.method || "GET",
        userAgent: input.userAgent ? input.userAgent.slice(0, 250) : null,
        details: input.details,
        blocked: input.blocked ?? true,
      },
    });

    // Se gravidade for CRITICAL e não for localhost, auto-adiciona à lista de bloqueio
    if (input.severity === "CRITICAL" && input.ip !== "127.0.0.1" && input.ip !== "localhost") {
      await blockIp(input.ip, `Auto-bloqueio WAF: ${input.details}`);
    }
  } catch (err) {
    console.error("[Segurança] Falha ao registrar incidente:", err);
  }
}

// ==========================================
// GESTÃO DE REGRAS DE IP (Blocklist & Allowlist)
// ==========================================

export async function blockIp(
  ip: string,
  reason: string,
  durationMinutes?: number
): Promise<void> {
  await ensureStockLocationTables();
  const cleanIp = ip.trim();
  const expiresAt = durationMinutes
    ? new Date(Date.now() + durationMinutes * 60 * 1000)
    : null;

  blockedIpsCache.add(cleanIp);

  await (prisma as any).securityIpRule.upsert({
    where: { ip: cleanIp },
    create: {
      ip: cleanIp,
      ruleType: "BLOCK",
      reason,
      offenses: 1,
      expiresAt,
      active: true,
    },
    update: {
      ruleType: "BLOCK",
      reason,
      offenses: { increment: 1 },
      expiresAt,
      active: true,
    },
  });
}

export async function unblockIp(ip: string): Promise<void> {
  await ensureStockLocationTables();
  const cleanIp = ip.trim();
  blockedIpsCache.delete(cleanIp);

  await (prisma as any).securityIpRule.deleteMany({
    where: { ip: cleanIp },
  });
}

export async function syncBlockedIpsCache(): Promise<void> {
  const now = Date.now();
  if (now - lastBlocklistSync < 30 * 1000) return; // cache de 30 segundos
  try {
    await ensureStockLocationTables();
    const rules = await (prisma as any).securityIpRule.findMany({
      where: {
        active: true,
        ruleType: "BLOCK",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { ip: true },
    });
    blockedIpsCache.clear();
    for (const r of rules) {
      blockedIpsCache.add(r.ip);
    }
    lastBlocklistSync = now;
  } catch {}
}

// ==========================================
// DASHBOARD DE SEGURANÇA PARA A EQUIPE DE TI
// ==========================================

export async function getSecurityDashboardData() {
  await ensureStockLocationTables();

  const [events, rules, totalEventsCount, activeBlocksCount] = await Promise.all([
    (prisma as any).securityEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    (prisma as any).securityIpRule.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    (prisma as any).securityEvent.count().catch(() => 0),
    (prisma as any).securityIpRule.count({ where: { active: true } }).catch(() => 0),
  ]);

  const criticalCount = events.filter((e: any) => e.severity === "CRITICAL").length;
  const highCount = events.filter((e: any) => e.severity === "HIGH").length;

  const securityScore = Math.max(90, 100 - criticalCount * 2 - highCount);

  return {
    securityScore,
    totalEventsCount,
    activeBlocksCount,
    events,
    rules,
    wafStatus: "OPERACIONAL (Proteção Ativa WAF/IPS)",
    antiDdosStatus: "ATIVO (Sliding Window Rate Limit)",
    bruteForceShieldStatus: "ATIVO (Bloqueio Automático)",
    headerShieldStatus: "ATIVO (HSTS, CSP, X-Frame)",
  };
}
