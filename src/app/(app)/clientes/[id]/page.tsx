import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { brl, fmtDate } from "@/lib/format";
import { PageHeader, StatusBadge } from "@/components/ui";
import { ActionForm } from "@/components/Forms";
import { PartyFields } from "@/components/PartyFields";
import { saveClient } from "../actions";

export default async function ClienteFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "novo";
  const client = isNew ? null : await prisma.client.findUnique({ where: { id: Number(id) } });
  if (!isNew && !client) notFound();

  const sales = client
    ? await prisma.sale.findMany({ where: { clientId: client.id }, orderBy: { date: "desc" }, take: 10 })
    : [];

  return (
    <>
      <PageHeader title={isNew ? "Novo cliente" : client!.name} subtitle={isNew ? "Preencha os dados do cliente" : "Editar cliente"} />
      <div className="card">
        <ActionForm
          action={saveClient.bind(null, client?.id ?? null)}
          extraActions={
            <Link className="btn secondary" href="/clientes">
              Cancelar
            </Link>
          }
        >
          <PartyFields data={client} />
        </ActionForm>
      </div>

      {client && (
        <div className="card flush">
          <div className="card-header">
            <h2>Últimas vendas</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Data</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/vendas/${s.id}`}>#{s.id}</Link>
                    </td>
                    <td>{fmtDate(s.date)}</td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="num">{brl(s.total)}</td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty">
                      Nenhuma venda para este cliente.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
