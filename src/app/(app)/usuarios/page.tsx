import Link from "next/link";
import { Plus, Shield } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { ALL_MODULE_KEYS, APP_MODULES, parsePermissions } from "@/lib/permissions";
import { ActiveBadge, FlashMessages, PageHeader, StatusBadge } from "@/components/ui";
import { ConfirmButton } from "@/components/Forms";
import { deleteUser } from "./actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

const MODULE_LABEL_BY_KEY = new Map(APP_MODULES.map((m) => [m.key, m.label]));

export default async function UsuariosPage({ searchParams }: { searchParams: SP }) {
  const session = await requireAdmin("usuarios");
  const sp = await searchParams;
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { sales: true } } },
  });

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle="Contas de acesso ao sistema e permissões individuais por módulo"
        actions={
          <Link className="btn" href="/usuarios/novo">
            <Plus size={15} /> Novo usuário
          </Link>
        }
      />
      <FlashMessages sp={sp} />
      <div className="alert info">
        <div>
          <strong>Administrador</strong>: acesso total a todos os 13 módulos. <strong>Funcionário</strong>: acesso
          personalizado por módulo (escolha exatamente quais menus cada colaborador pode ver e acessar).
        </div>
      </div>
      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Módulos Liberados</th>
                <th className="num">Vendas</th>
                <th>Criado em</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const perms = parsePermissions(u.permissions, u.role);
                return (
                  <tr key={u.id}>
                    <td className="bold">
                      <Link href={`/usuarios/${u.id}`}>{u.name}</Link>{" "}
                      {u.id === session.userId && <span className="muted small">(você)</span>}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <StatusBadge status={u.role} />
                    </td>
                    <td>
                      {u.role === "ADMIN" ? (
                        <span className="badge green">
                          <Shield size={11} /> Acesso Total ({ALL_MODULE_KEYS.length}/{ALL_MODULE_KEYS.length})
                        </span>
                      ) : (
                        <div>
                          <span className="badge blue">
                            {perms.length} de {ALL_MODULE_KEYS.length} módulos
                          </span>
                          <div className="muted small" style={{ marginTop: 3, maxWidth: 280 }}>
                            {perms
                              .slice(0, 4)
                              .map((k) => MODULE_LABEL_BY_KEY.get(k) ?? k)
                              .join(", ")}
                            {perms.length > 4 ? ` +${perms.length - 4}` : ""}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="num">{u._count.sales}</td>
                    <td>{fmtDateTime(u.createdAt)}</td>
                    <td>
                      <ActiveBadge active={u.active} />
                    </td>
                    <td className="actions">
                      <Link className="btn sm secondary" href={`/usuarios/${u.id}`}>
                        Editar / Acessos
                      </Link>
                      {u.id !== session.userId && (
                        <ConfirmButton
                          action={deleteUser.bind(null, u.id)}
                          label="Excluir"
                          className="btn sm danger"
                          confirmText={`Excluir o usuário "${u.name}"?`}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
