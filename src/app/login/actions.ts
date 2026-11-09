"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { FormState } from "@/lib/form";

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Informe e-mail e senha." };

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user && user.active && (await bcrypt.compare(password, user.passwordHash));
  if (!ok || !user) return { error: "E-mail ou senha inválidos." };

  const session = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: (user.role === "ADMIN" ? "ADMIN" : "FUNCIONARIO") as "ADMIN" | "FUNCIONARIO",
  };
  await createSession(session);
  await logAudit(session, "AUTH", "LOGIN", `Login efetuado por ${user.email}`, user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
