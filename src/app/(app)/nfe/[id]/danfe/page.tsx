import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "@/lib/audit";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { DanfeDocument } from "@/lib/nfe/danfe-renderer";
import { PrintButton } from "@/components/PrintButton";

export default async function DanfePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await ensureStockLocationTables();

  const [invoice, company] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id: Number(id) },
      include: {
        client: true,
        items: true,
      },
    }),
    getCompanySettings(),
  ]);

  if (!invoice) notFound();

  const danfeData = {
    invoice: {
      id: invoice.id,
      number: invoice.number,
      series: invoice.series,
      type: invoice.type,
      status: invoice.status,
      environment: invoice.environment,
      accessKey: invoice.accessKey,
      protocol: invoice.protocol,
      authorizedAt: invoice.authorizedAt,
      createdAt: invoice.createdAt,
      totalProducts: invoice.totalProducts,
      totalDiscount: invoice.totalDiscount,
      totalFreight: invoice.totalFreight,
      totalInvoice: invoice.totalInvoice,
      baseIcms: invoice.baseIcms,
      valueIcms: invoice.valueIcms,
      valuePis: invoice.valuePis,
      valueCofins: invoice.valueCofins,
      approxTaxTotal: invoice.approxTaxTotal,
      fiscalNotes: invoice.fiscalNotes,
      items: invoice.items.map((it) => ({
        id: it.id,
        itemNumber: it.itemNumber,
        sku: it.sku,
        name: it.name,
        ncm: it.ncm,
        cfop: it.cfop,
        unit: it.unit,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
        discount: it.discount,
        origin: it.origin,
        csosn: it.csosn,
        icmsRate: it.icmsRate,
        icmsValue: it.icmsValue,
      })),
    },
    company: {
      name: company.name,
      tradeName: company.tradeName,
      document: company.document,
      stateRegistration: company.stateRegistration,
      address: company.address,
      city: company.city,
      state: company.state,
      zipCode: company.zipCode,
      phone: company.phone,
      logoUrl: company.logoUrl,
    },
    recipient: {
      name: invoice.client?.name || "Consumidor Final",
      document: invoice.client?.document,
      ie: invoice.client?.ie,
      address: invoice.client?.address,
      city: invoice.client?.city,
      state: invoice.client?.state,
      zipCode: invoice.client?.zipCode,
      phone: invoice.client?.phone,
    },
  };

  return (
    <>
      {/* Barra de Ações (Oculta na Impressão) */}
      <div
        className="no-print"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: "12px 18px",
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link href={`/nfe/${invoice.id}`} className="btn secondary" style={{ fontSize: 13 }}>
            <ArrowLeft size={16} /> Voltar à NF-e
          </Link>
          <span style={{ fontWeight: 700, fontSize: 14 }}>
            DANFE — Nota Fiscal Eletrônica nº {invoice.number}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a
            href={`/nfe/${invoice.id}/xml`}
            download={`NFe-${invoice.accessKey || invoice.number}.xml`}
            className="btn secondary"
            style={{ fontSize: 13 }}
          >
            <Download size={15} /> Baixar XML Oficial
          </a>
          <PrintButton label="Imprimir DANFE" />
        </div>
      </div>

      <div className="danfe-page-container table-responsive" style={{ padding: "0 0 20px", display: "flex", justifyContent: "center" }}>
        <DanfeDocument data={danfeData} />
      </div>
    </>
  );
}
