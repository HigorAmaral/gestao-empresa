import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureStockLocationTables } from "@/lib/stock-location";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await ensureStockLocationTables();

  const invoice = await prisma.invoice.findUnique({
    where: { id: Number(id) },
  });

  if (!invoice || !invoice.xmlContent) {
    return new NextResponse("XML da NF-e não encontrado.", { status: 404 });
  }

  const filename = `NFe-${invoice.accessKey || invoice.number}.xml`;

  return new NextResponse(invoice.xmlContent, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
