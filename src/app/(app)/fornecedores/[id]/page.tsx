import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { brl, num } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/Forms";
import { PartyFields } from "@/components/PartyFields";
import { saveSupplier } from "../actions";

export default async function FornecedorFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "novo";
  const supplier = isNew ? null : await prisma.supplier.findUnique({ where: { id: Number(id) } });
  if (!isNew && !supplier) notFound();

  const products = supplier
    ? await prisma.product.findMany({ where: { supplierId: supplier.id }, orderBy: { name: "asc" } })
    : [];

  return (
    <>
      <PageHeader
        title={isNew ? "Novo fornecedor" : supplier!.name}
        subtitle={isNew ? "Preencha os dados do fornecedor" : "Editar fornecedor"}
      />
      <div className="card">
        <ActionForm
          action={saveSupplier.bind(null, supplier?.id ?? null)}
          extraActions={
            <Link className="btn secondary" href="/fornecedores">
              Cancelar
            </Link>
          }
        >
          <PartyFields data={supplier} />
        </ActionForm>
      </div>

      {supplier && (
        <div className="card flush">
          <div className="card-header">
            <h2>Produtos deste fornecedor</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Produto</th>
                  <th className="num">Custo</th>
                  <th className="num">Estoque</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.sku}</td>
                    <td>
                      <Link href={`/produtos/${p.id}`}>{p.name}</Link>
                    </td>
                    <td className="num">{brl(p.costPrice)}</td>
                    <td className="num">
                      {num(p.stock)} {p.unit}
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty">
                      Nenhum produto vinculado.
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
