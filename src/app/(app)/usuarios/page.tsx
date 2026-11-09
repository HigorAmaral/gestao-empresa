import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { ActiveBadge, FlashMessages, PageHeader, StatusBadge } from "@/components/ui";
import { ConfirmButton } from "@/components/Forms";
import { deleteUser } from "./actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function UsuariosPage({ searchParams }: { searchParams: SP }) {
  const session = await requireAdmin();
  const sp = await searchParams;
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { sales: true } } },
  });

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle="Contas de acesso ao sistema e perfis de permissão"
        actions={
          <Link className="btn" href="/usuarios/novo">
            <Plus size={15} /> Novo usuário
          </Link>
        }
      />
      <FlashMessages sp={sp} />
      <div className="alert info">
        <div>
          <strong>Administrador</strong>: acesso total. <strong>Funcionário</strong>: vendas, ordens de serviço, clientes, produtos,
          estoque, compras e fornecedores (sem financeiro, RH, relatórios, auditoria, configurações e usuários).
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
                <th className="num">Vendas</th>
                <th>Criado em</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="bold">
                    <Link href={`/usuarios/${u.id}`}>{u.name}</Link> {u.id === session.userId && <span className="muted small">(você)</span>}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <StatusBadge status={u.role} />
                  </td>
                  <td className="num">{u._count.sales}</td>
                  <td>{fmtDateTime(u.createdAt)}</td>
                  <td>
                    <ActiveBadge active={u.active} />
                  </td>
                  <td className="actions">
                    <Link className="btn sm secondary" href={`/usuarios/${u.id}`}>
                      Editar
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
