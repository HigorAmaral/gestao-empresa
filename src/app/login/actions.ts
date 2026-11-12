"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parsePermissions } from "@/lib/permissions";
import {
  checkBruteForceLockout,
  recordFailedLoginAttempt,
  clearLoginAttempts,
  logSecurityIncident,
} from "@/lib/security";
import type { FormState } from "@/lib/form";

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Informe e-mail e senha." };

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "127.0.0.1";
  const userAgent = h.get("user-agent") || "";

  // 1. Verificação de Bloqueio por Força Bruta (Anti-Brute Force Shield)
  const [emailLock, ipLock] = await Promise.all([
    checkBruteForceLockout(email),
    checkBruteForceLockout(ip),
  ]);

  if (emailLock.locked) {
    return {
      error: `Acesso temporariamente bloqueado por segurança. Muitas tentativas incorretas para esta conta. Tente novamente em ${emailLock.remainingMinutes} minuto(s).`,
    };
  }

  if (ipLock.locked) {
    return {
      error: `Endereço IP temporariamente suspenso por atividade suspeita de força bruta. Aguarde ${ipLock.remainingMinutes} minuto(s).`,
    };
  }

  // 2. Busca e Validação de Credenciais
  const user = await prisma.user.findUnique({ where: { email } });
  const isPasswordValid =
    user && user.active && (await bcrypt.compare(password, user.passwordHash));

  if (!isPasswordValid || !user) {
    // Registra falha e atualiza contadores
    const [userAttempt] = await Promise.all([
      recordFailedLoginAttempt(email, ip),
      recordFailedLoginAttempt(ip, ip),
    ]);

    await logSecurityIncident({
      ip,
      eventType: "UNAUTHORIZED_ACCESS",
      severity: userAttempt.locked ? "CRITICAL" : "MEDIUM",
      endpoint: "/login",
      method: "POST",
      userAgent,
      details: `Tentativa de login com senha incorreta para conta: "${email}". Tentativa ${userAttempt.attempts}/5.`,
      blocked: false,
    });

    if (userAttempt.locked) {
      return {
        error:
          "Limite de 5 tentativas consecutivas excedido. Por segurança cibernética contra invasões, o acesso foi bloqueado por 15 minutos.",
      };
    }

    const remainingAttempts = Math.max(1, 5 - userAttempt.attempts);
    return {
      error: `E-mail ou senha inválidos. ${remainingAttempts} tentativa(s) restante(s) antes do bloqueio de segurança.`,
    };
  }

  // 3. Sucesso: Limpa contadores de tentativas
  await Promise.all([clearLoginAttempts(email), clearLoginAttempts(ip)]);

  const role = (user.role === "ADMIN" ? "ADMIN" : "FUNCIONARIO") as "ADMIN" | "FUNCIONARIO";
  const session = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role,
    permissions: parsePermissions(user.permissions, role),
  };

  await createSession(session);
  await logAudit(session, "AUTH", "LOGIN", `Login seguro autenticado por ${user.email} (IP: ${ip})`, user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
