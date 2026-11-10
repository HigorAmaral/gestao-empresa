import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { hasModuleAccess, type ModuleKey } from "./permissions";
import { SESSION_COOKIE, SESSION_HOURS, signToken, verifyToken, type Session } from "./token";

export type { Session };

export async function createSession(session: Session) {
  const token = await signToken(session);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * SESSION_HOURS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Lê e valida a sessão diretamente do JWT assinado em memória (0ms, sem round-trip ao banco).
 * Envolvido em React.cache() para deduplicar chamadas no mesmo request.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
});

export async function requireUser(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireModule(moduleKey: ModuleKey): Promise<Session> {
  const session = await requireUser();
  if (!hasModuleAccess(session, moduleKey)) {
    redirect("/?erro=" + encodeURIComponent("Você não tem permissão para acessar este módulo."));
  }
  return session;
}

const ADMIN_MODULES: ModuleKey[] = [
  "financeiro",
  "funcionarios",
  "relatorios",
  "usuarios",
  "auditoria",
  "configuracoes",
];

export async function requireAdmin(moduleKey?: ModuleKey): Promise<Session> {
  const session = await requireUser();
  if (session.role === "ADMIN") return session;
  if (moduleKey && hasModuleAccess(session, moduleKey)) return session;
  if (!moduleKey && ADMIN_MODULES.some((m) => hasModuleAccess(session, m))) return session;
  redirect("/?erro=" + encodeURIComponent("Você não tem permissão para acessar este módulo."));
}
