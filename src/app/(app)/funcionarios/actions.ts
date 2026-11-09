"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { bool, dateVal, num, reqStr, str, toFormError, ValidationError, type FormState } from "@/lib/form";

export async function saveEmployee(id: number | null, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const hireDate = dateVal(fd, "hireDate");
    if (!hireDate) throw new ValidationError("Informe a data de admissão.");
    const salary = num(fd, "salary");
    if (salary < 0) throw new ValidationError("Salário não pode ser negativo.");
    const data = {
      name: reqStr(fd, "name", "Nome"),
      document: str(fd, "document"),
      email: str(fd, "email")?.toLowerCase() ?? null,
      phone: str(fd, "phone"),
      position: reqStr(fd, "position", "Cargo"),
      department: str(fd, "department"),
      salary,
      hireDate,
      active: bool(fd, "active"),
      notes: str(fd, "notes"),
    };
    if (id) await prisma.employee.update({ where: { id }, data });
    else await prisma.employee.create({ data });
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/funcionarios");
  redirect("/funcionarios?ok=" + encodeURIComponent("Funcionário salvo."));
}

export async function deleteEmployee(id: number) {
  await requireAdmin();
  await prisma.employee.delete({ where: { id } });
  revalidatePath("/funcionarios");
  redirect("/funcionarios?ok=" + encodeURIComponent("Funcionário excluído."));
}

/** Gera as despesas de salário do mês para todos os funcionários ativos. */
export async function generatePayroll(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const month = str(fd, "month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return { error: "Informe o mês de referência." };
  const day = Math.min(28, Math.max(1, Math.floor(num(fd, "day", 5))));
  const [y, m] = month.split("-").map(Number);
  // Vencimento no mês seguinte ao de referência
  const dueDate = new Date(Date.UTC(y, m, day));
  const label = `${String(m).padStart(2, "0")}/${y}`;

  const employees = await prisma.employee.findMany({ where: { active: true, salary: { gt: 0 } } });
  if (employees.length === 0) return { error: "Nenhum funcionário ativo com salário cadastrado." };

  const existing = await prisma.financialEntry.count({ where: { category: "Salários", description: { contains: `ref. ${label}` } } });
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
