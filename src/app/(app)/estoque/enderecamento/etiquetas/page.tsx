import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "@/lib/audit";
import { PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";

/** Gera barras visuais determinísticas a partir do código do endereço. */
function codeBars(code: string): number[] {
  const str = `*${code.toUpperCase()}*`;
  const bars: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    bars.push((c % 3) + 1, ((c >> 2) % 2) + 1, ((c >> 4) % 3) + 1, 1);
  }
  return bars;
}

export default async function LocationLabelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const singleId = typeof sp.id === "string" && /^\d+$/.test(sp.id) ? Number(sp.id) : null;

  const [locations, company] = await Promise.all([
    prisma.stockLocation.findMany({
      where: singleId ? { id: singleId } : { active: true },
      orderBy: { code: "asc" },
      include: {
        items: {
          include: { product: true },
        },
      },
    }),
    getCompanySettings(),
  ]);

  const brand = company.tradeName || company.name;

  return (
    <>
      <PageHeader
        title="Etiquetas de Endereçamento de Estoque"
        subtitle={
          singleId
            ? "Etiqueta individual pronta para impressão e fixação na gôndola/estante"
            : `${locations.length} etiqueta(s) de endereços ativas para identificação visual no galpão`
        }
        actions={
          <>
            <Link className="btn secondary" href="/estoque/enderecamento">
              <ArrowLeft size={15} /> Voltar ao Endereçamento
            </Link>
            <PrintButton label="Imprimir Etiquetas de Endereço" />
          </>
        }
      />

      <div className="labels-sheet">
        {locations.map((loc) => {
          const bars = codeBars(loc.code);
          const detail = [loc.aisle, loc.rack, loc.shelf, loc.bin].filter(Boolean).join(" • ");

          return (
            <div key={loc.id} className="price-label-card" style={{ minHeight: 150 }}>
              <div className="price-label-top">
                <span className="price-label-brand">{brand}</span>
                <span className="price-label-cat">ESTOQUE / WMS</span>
              </div>

              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 20,
                  fontWeight: 900,
                  letterSpacing: "0.06em",
                  color: "#09090b",
                  margin: "8px 0 4px",
                  textAlign: "center",
                }}
              >
                {loc.code}
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: "#71717a",
                  textAlign: "center",
                  fontWeight: 500,
                  marginBottom: 6,
                }}
              >
                {detail || "Área de Armazenamento"}
              </div>

              <div className="barcode-bars" aria-hidden="true" style={{ height: 28, margin: "4px auto" }}>
                {bars.map((w, idx) => (
                  <span
                    key={idx}
                    style={{
                      width: `${w * 1.5}px`,
                      background: idx % 2 === 0 ? "#09090b" : "transparent",
                    }}
                  />
                ))}
              </div>

              <div
                style={{
                  fontSize: 10,
                  color: "#52525b",
                  textAlign: "center",
                  marginTop: 6,
                  borderTop: "1px dashed #e4e4e7",
                  paddingTop: 4,
                }}
              >
                {loc.items.length > 0
                  ? `${loc.items.length} produto(s) alocado(s)`
                  : "Posição Livre / Disponível"}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
