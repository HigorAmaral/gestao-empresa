import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { brl } from "@/lib/format";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const numId = /^\d+$/.test(q.replace(/^#/, "")) ? Number(q.replace(/^#/, "")) : null;

  const [clients, products, sales, serviceOrders] = await Promise.all([
    prisma.client.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { document: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 4,
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 4,
      orderBy: { name: "asc" },
    }),
    prisma.sale.findMany({
      where: numId
        ? { id: numId }
        : { client: { name: { contains: q, mode: "insensitive" } } },
      include: { client: { select: { name: true } } },
      take: 4,
      orderBy: { id: "desc" },
    }),
    prisma.serviceOrder.findMany({
      where: numId
        ? { id: numId }
        : {
            OR: [
              { equipment: { contains: q, mode: "insensitive" } },
              { client: { name: { contains: q, mode: "insensitive" } } },
            ],
          },
      include: { client: { select: { name: true } } },
      take: 4,
      orderBy: { id: "desc" },
    }),
  ]);

  const results = [
    ...clients.map((c) => ({
      type: "Cliente",
      title: c.name,
      subtitle: [c.document, c.phone].filter(Boolean).join(" • ") || "Ver ficha 360º",
      href: `/clientes/${c.id}`,
    })),
    ...products.map((p) => ({
      type: "Produto",
      title: `${p.name} (${p.sku})`,
      subtitle: `${brl(p.salePrice)} • Estoque: ${p.stock} ${p.unit}`,
      href: `/produtos/${p.id}`,
    })),
    ...sales.map((s) => ({
      type: "Venda",
      title: `Venda #${s.id} — ${s.client?.name ?? "Consumidor final"}`,
      subtitle: `${brl(s.total)} • ${s.status}`,
      href: `/vendas/${s.id}`,
    })),
    ...serviceOrders.map((os) => ({
      type: "OS",
      title: `OS #${os.id} — ${os.equipment}`,
      subtitle: `${os.client?.name ?? "Cliente avulso"} • ${brl(os.total)}`,
      href: `/os/${os.id}`,
    })),
  ];

  return NextResponse.json({ results });
}
