import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "@/lib/audit";
import { brl } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";

/** Gera barras visuais determinísticas a partir do código SKU para impressão de etiquetas. */
function skuBars(sku: string): number[] {
  const str = `*${sku.toUpperCase()}*`;
  const bars: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bars.push((code % 3) + 1, ((code >> 2) % 2) + 1, ((code >> 4) % 3) + 1, 1);
  }
  return bars;
}

export default async function ProductLabelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const singleId = typeof sp.id === "string" && /^\d+$/.test(sp.id) ? Number(sp.id) : null;

  const [products, company] = await Promise.all([
    prisma.product.findMany({
      where: singleId ? { id: singleId } : { active: true },
      orderBy: { name: "asc" },
    }),
    getCompanySettings(),
  ]);

  const brand = company.tradeName || company.name;

  return (
    <>
      <PageHeader
        title="Etiquetas de Produtos / Gôndola"
        subtitle={
          singleId
            ? "Etiqueta individual pronta para impressão"
            : `${products.length} etiqueta(s) do catálogo ativo prontas para impressão`
        }
        actions={
          <>
            <Link className="btn secondary" href="/produtos">
              <ArrowLeft size={15} /> Voltar a produtos
            </Link>
            <PrintButton label="Imprimir Etiquetas" />
          </>
        }
      />

      <div className="labels-sheet">
        {products.map((p) => {
          const bars = skuBars(p.sku);
          return (
            <div key={p.id} className="price-label-card">
              <div className="price-label-top">
                <span className="price-label-brand">{brand}</span>
                <span className="price-label-cat">{p.category || p.unit}</span>
              </div>
              <div className="price-label-name" title={p.name}>
                {p.name}
              </div>
              <div className="price-label-price">{brl(p.salePrice)}</div>
              <div className="price-label-unit">por {p.unit}</div>
              <div className="barcode-bars" aria-hidden="true">
                {bars.map((w, idx) => (
                  <span
                    key={idx}
                    style={{
                      width: `${w * 1.6}px`,
                      background: idx % 2 === 0 ? "#09090b" : "transparent",
                    }}
                  />
                ))}
              </div>
              <div className="price-label-sku">{p.sku}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
