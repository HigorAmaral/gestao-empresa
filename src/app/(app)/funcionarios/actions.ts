"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { serializePermissions } from "@/lib/permissions";
import { bool, dateVal, num, reqStr, str, toFormError, ValidationError, type FormState } from "@/lib/form";

export async function saveEmployee(id: number | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireAdmin("funcionarios");
  try {
    const hireDate = dateVal(fd, "hireDate");
    if (!hireDate) throw new ValidationError("Informe a data de admissão.");
    const salary = num(fd, "salary");
    if (salary < 0) throw new ValidationError("Salário não pode ser negativo.");

    const name = reqStr(fd, "name", "Nome");
    const email = str(fd, "email")?.toLowerCase() ?? null;
    const active = bool(fd, "active");

    const enableLogin = bool(fd, "enableLogin");
    const role = str(fd, "role") === "ADMIN" ? "ADMIN" : "FUNCIONARIO";
    const loginPassword = str(fd, "loginPassword");
    const rawPerms = fd.getAll("permissions").map(String);
    const permissions = role === "ADMIN" ? "*" : serializePermissions(rawPerms);

    const existingEmp = id
      ? await prisma.employee.findUnique({ where: { id }, include: { user: true } })
      : null;

    let linkedUserId = existingEmp?.userId ?? null;

    if (enableLogin) {
      if (!email) {
        throw new ValidationError("Informe o e-mail do funcionário para liberar o login no sistema.");
      }
      if (loginPassword && loginPassword.length < 6) {
        throw new ValidationError("A senha de login deve ter pelo menos 6 caracteres.");
      }

      // Verifica se já existe usuário vinculado ou com este e-mail
      const existingUserByEmail = await prisma.user.findUnique({ where: { email } });
      const targetUserId = linkedUserId ?? existingUserByEmail?.id ?? null;

      if (!targetUserId && !loginPassword) {
        throw new ValidationError("Defina uma senha inicial (mínimo 6 caracteres) para criar o login do funcionário.");
      }

      if (targetUserId) {
        const updatedUser = await prisma.user.update({
          where: { id: targetUserId },
          data: {
            name,
            email,
            role,
            permissions,
            active,
            ...(loginPassword ? { passwordHash: await bcrypt.hash(loginPassword, 10) } : {}),
          },
        });
        linkedUserId = updatedUser.id;
      } else {
        const createdUser = await prisma.user.create({
          data: {
            name,
            email,
            role,
            permissions,
            active,
            passwordHash: await bcrypt.hash(loginPassword!, 10),
          },
        });
        linkedUserId = createdUser.id;
      }
    } else if (linkedUserId && linkedUserId !== session.userId) {
      // Se desmarcou "Liberar login", inativa o acesso do usuário vinculado
      await prisma.user.update({
        where: { id: linkedUserId },
        data: { active: false, permissions },
      });
    }

    const data = {
      name,
      document: str(fd, "document"),
      email,
      phone: str(fd, "phone"),
      position: reqStr(fd, "position", "Cargo"),
      department: str(fd, "department"),
      salary,
      hireDate,
      active,
      notes: str(fd, "notes"),
      permissions,
      userId: linkedUserId,
    };

    if (id) {
      await prisma.employee.update({ where: { id }, data });
      await logAudit(session, "RH", "EDITAR", `Editou funcionário "${name}" e suas permissões`, id);
    } else {
      const created = await prisma.employee.create({ data });
      await logAudit(session, "RH", "CRIAR", `Cadastrou funcionário "${name}"`, created.id);
    }
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/funcionarios");
  revalidatePath("/usuarios");
  redirect("/funcionarios?ok=" + encodeURIComponent("Funcionário e permissões de acesso salvos."));
}

export async function deleteEmployee(id: number) {
  await requireAdmin("funcionarios");
  await prisma.employee.delete({ where: { id } });
  revalidatePath("/funcionarios");
  redirect("/funcionarios?ok=" + encodeURIComponent("Funcionário excluído."));
}

/** Gera as despesas de salário do mês para todos os funcionários ativos. */
export async function generatePayroll(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin("funcionarios");
  const month = str(fd, "month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return { error: "Informe o mês de referência." };
  const day = Math.min(28, Math.max(1, Math.floor(num(fd, "day", 5))));
  const [y, m] = month.split("-").map(Number);
  // Vencimento no mês seguinte ao de referência
  const dueDate = new Date(Date.UTC(y, m, day));
  const label = `${String(m).padStart(2, "0")}/${y}`;

  const employees = await prisma.employee.findMany({ where: { active: true, salary: { gt: 0 } } });
  if (employees.length === 0) return { error: "Nenhum funcionário ativo com salário cadastrado." };

  const existing = await prisma.financialEntry.count({
    where: { category: "Salários", description: { contains: `ref. ${label}` } },
  });
  if (existing > 0) return { error: `A folha de ${label} já foi gerada.` };

  await prisma.financialEntry.createMany({
    data: employees.map((e) => ({
      type: "DESPESA",
      description: `Salário ${e.name} — ref. ${label}`,
      category: "Salários",
      amount: e.salary,
      dueDate,
    })),
  });
  revalidatePath("/financeiro");
  const total = employees.reduce((s, e) => s + e.salary, 0);
  return {
    success: `Folha de ${label} gerada: ${employees.length} lançamento(s), total ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
  };
}
