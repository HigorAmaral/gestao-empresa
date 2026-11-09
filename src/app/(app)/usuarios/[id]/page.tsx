import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/Forms";
import { saveUser } from "../actions";

export default async function UsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const isNew = id === "novo";
  const user = isNew ? null : await prisma.user.findUnique({ where: { id: Number(id) } });
  if (!isNew && !user) notFound();

  return (
    <>
      <PageHeader title={isNew ? "Novo usuário" : user!.name} subtitle={isNew ? "Crie uma conta de acesso" : "Editar usuário"} />
      <div className="card" style={{ maxWidth: 760 }}>
        <ActionForm
          action={saveUser.bind(null, user?.id ?? null)}
          extraActions={
            <Link className="btn secondary" href="/usuarios">
              Cancelar
            </Link>
          }
        >
          <div className="form-grid">
            <div className="field">
              <label>Nome *</label>
              <input name="name" defaultValue={user?.name ?? ""} required />
            </div>
            <div className="field">
              <label>E-mail (login) *</label>
              <input name="email" type="email" defaultValue={user?.email ?? ""} required />
            </div>
            <div className="field">
              <label>Perfil</label>
              <select name="role" defaultValue={user?.role ?? "FUNCIONARIO"}>
                <option value="FUNCIONARIO">Funcionário</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
            <div className="field">
              <label>{isNew ? "Senha *" : "Nova senha (deixe em branco para manter)"}</label>
              <input name="password" type="password" minLength={6} autoComplete="new-password" required={isNew} />
            </div>
            <div className="field s12">
              <label className="checkbox">
                <input type="checkbox" name="active" defaultChecked={user?.active ?? true} /> Usuário ativo (pode fazer login)
              </label>
            </div>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
