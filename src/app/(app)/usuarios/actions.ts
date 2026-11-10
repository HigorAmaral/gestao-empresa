"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, requireAdmin, requireUser } from "@/lib/auth";
import { parsePermissions, serializePermissions } from "@/lib/permissions";
import { bool, reqStr, str, toFormError, ValidationError, type FormState } from "@/lib/form";

export async function saveUser(id: number | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireAdmin("usuarios");
  try {
    const name = reqStr(fd, "name", "Nome");
    const email = reqStr(fd, "email", "E-mail").toLowerCase();
    const role = str(fd, "role") === "ADMIN" ? "ADMIN" : "FUNCIONARIO";
    const active = bool(fd, "active");
    const password = str(fd, "password");
    const rawPerms = fd.getAll("permissions").map(String);
    const permissions = role === "ADMIN" ? "*" : serializePermissions(rawPerms);

    if (!id && !password) throw new ValidationError("Informe uma senha para o novo usuário.");
    if (password && password.length < 6) throw new ValidationError("A senha deve ter pelo menos 6 caracteres.");
    if (id === session.userId && (!active || role !== "ADMIN"))
      throw new ValidationError("Você não pode inativar nem remover o perfil de administrador do seu próprio usuário.");

    const data = {
      name,
      email,
      role,
      permissions,
      active,
      ...(password && { passwordHash: await bcrypt.hash(password, 10) }),
    };

    if (id) {
      const updated = await prisma.user.update({ where: { id }, data });
      // Sincroniza permissões no Employee vinculado, se existir
      await prisma.employee.updateMany({
        where: { userId: id },
        data: { permissions },
      });
      if (id === session.userId) {
        await createSession({
          userId: updated.id,
          name: updated.name,
          email: updated.email,
          role: updated.role === "ADMIN" ? "ADMIN" : "FUNCIONARIO",
          permissions: parsePermissions(updated.permissions, updated.role),
        });
      }
    } else {
      await prisma.user.create({ data: { ...data, passwordHash: data.passwordHash! } });
    }
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/usuarios");
  revalidatePath("/funcionarios");
  redirect("/usuarios?ok=" + encodeURIComponent("Usuário e permissões salvos."));
}

export async function deleteUser(id: number) {
  const session = await requireAdmin("usuarios");
  if (id === session.userId)
    redirect("/usuarios?erro=" + encodeURIComponent("Você não pode excluir seu próprio usuário."));
  await prisma.user.delete({ where: { id } });
  revalidatePath("/usuarios");
  redirect("/usuarios?ok=" + encodeURIComponent("Usuário excluído."));
}

export async function changeOwnPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireUser();
  try {
    const current = reqStr(fd, "current", "Senha atual");
    const next = reqStr(fd, "next", "Nova senha");
    const confirm = reqStr(fd, "confirm", "Confirmação");
    if (next.length < 6) throw new ValidationError("A nova senha deve ter pelo menos 6 caracteres.");
    if (next !== confirm) throw new ValidationError("A confirmação não confere com a nova senha.");
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || !(await bcrypt.compare(current, user.passwordHash)))
      throw new ValidationError("Senha atual incorreta.");
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  } catch (e) {
    return toFormError(e);
  }
  return { success: "Senha alterada com sucesso." };
}
