import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { pageParams, spStr } from "@/lib/form";
import { fmtDateTime } from "@/lib/format";
import { ExportCsvButton, PageHeader, Pagination } from "@/components/ui";

type SP = Promise<Record<string, string | string[] | undefined>>;

const MODULES = ["AUTH", "VENDAS", "OS", "COMPRAS", "ESTOQUE", "FINANCEIRO", "CLIENTES", "FORNECEDORES", "PRODUTOS", "RH", "USUARIOS", "CONFIG"];
const ACTIONS = ["LOGIN", "CRIAR", "EDITAR", "CONFIRMAR", "RECEBER", "BAIXAR", "CANCELAR", "EXCLUIR"];

export default async function AuditoriaPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = spStr(sp, "q");
  const mod = spStr(sp, "module");
  const act = spStr(sp, "action");
  const { page, skip, take, pageSize } = pageParams(sp, 25);

  const where: Prisma.AuditLogWhereInput = {
    ...(q && { OR: [{ details: { contains: q } }, { userName: { contains: q } }, { entityId: { contains: q } }] }),
    ...(mod && { module: mod }),
    ...(act && { action: act }),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.auditLog.count({ where }),
  ]);

  return (
    <>
      <PageHeader
        title="Log de Auditoria"
        subtitle="Histórico de operações e segurança registradas no sistema"
        actions={<ExportCsvButton entity="auditoria" />}
      />

      <form className="filters">
        <input className="grow" name="q" placeholder="Buscar por usuário, detalhes ou ID do registro..." defaultValue={q} />
        <select name="module" defaultValue={mod}>
          <option value="">Todos os módulos</option>
          {MODULES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select name="action" defaultValue={act}>
          <option value="">Todas as ações</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <button className="btn secondary">Filtrar</button>
      </form>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data / Hora</th>
                <th>Usuário</th>
                <th>Módulo</th>
                <th>Ação</th>
                <th>Reg. #</th>
                <th>Descrição</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDateTime(l.createdAt)}</td>
                  <td className="bold">{l.userName}</td>
                  <td>
                    <span className="badge gray">{l.module}</span>
                  </td>
                  <td>
                    <span className="badge blue">{l.action}</span>
                  </td>
                  <td className="muted">{l.entityId ?? "—"}</td>
                  <td>{l.details}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    Nenhum registro de auditoria encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination basePath="/auditoria" sp={sp} page={page} pageSize={pageSize} total={total} />
      </div>
    </>
  );
}
