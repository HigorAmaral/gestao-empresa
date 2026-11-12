import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { normalizeRole, parsePermissions } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/Forms";
import { PermissionsSelector } from "@/components/PermissionsSelector";
import { saveUser } from "../actions";

export default async function UsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("usuarios");
  const { id } = await params;
  const isNew = id === "novo";
  const user = isNew ? null : await prisma.user.findUnique({ where: { id: Number(id) } });
  if (!isNew && !user) notFound();

  const currentRole = normalizeRole(user?.role);
  const currentPermissions = parsePermissions(user?.permissions, currentRole);

  return (
    <>
      <PageHeader
        title={isNew ? "Novo usuário" : user!.name}
        subtitle={isNew ? "Crie uma conta de acesso e defina os módulos liberados" : "Editar usuário e permissões"}
      />
      <div className="card">
        <ActionForm
          action={saveUser.bind(null, user?.id ?? null)}
          extraActions={
            <Link className="btn secondary" href="/usuarios">
              Cancelar
            </Link>
          }
        >
          <div className="form-grid">
            <div className="field s4">
              <label>Nome *</label>
              <input name="name" defaultValue={user?.name ?? ""} required />
            </div>
            <div className="field s4">
              <label>E-mail (login) *</label>
              <input name="email" type="email" defaultValue={user?.email ?? ""} required />
            </div>
            <div className="field s4">
              <label>{isNew ? "Senha *" : "Nova senha (deixe em branco para manter)"}</label>
              <input name="password" type="password" minLength={6} autoComplete="new-password" required={isNew} />
            </div>
            <div className="field s12">
              <label className="checkbox">
                <input type="checkbox" name="active" defaultChecked={user?.active ?? true} /> Usuário ativo (pode fazer
                login)
              </label>
            </div>

            <PermissionsSelector
              mode="user"
              defaultPermissions={currentPermissions}
              defaultRole={currentRole}
              hasExistingUser={!isNew}
            />
          </div>
        </ActionForm>
      </div>
    </>
  );
}
