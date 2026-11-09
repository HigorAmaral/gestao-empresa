import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { fmtDate, fmtDateTime, STATUS_LABEL } from "@/lib/format";

function csvCell(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val).replace(/\r?\n/g, " ");
  if (str.includes(";") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(";")];
  for (const r of rows) {
    lines.push(r.map(csvCell).join(";"));
  }
  // BOM UTF-8 para que o Microsoft Excel abra acentos e colunas automaticamente
  return "\uFEFF" + lines.join("\r\n");
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse("Não autorizado", { status: 401 });

  const entity = req.nextUrl.searchParams.get("entity") ?? "";
  const isAdmin = session.role === "ADMIN";
  const adminEntities = ["financeiro", "funcionarios", "auditoria"];
  if (adminEntities.includes(entity) && !isAdmin) {
    return new NextResponse("Acesso restrito a administradores", { status: 403 });
  }

  let filename = `${entity || "dados"}.csv`;
  let csv = "";

  if (entity === "clientes") {
    const list = await prisma.client.findMany({ orderBy: { name: "asc" } });
    csv = buildCsv(
      ["ID", "Nome", "CPF/CNPJ", "E-mail", "Telefone", "Endereço", "Cidade", "UF", "Ativo"],
      list.map((c) => [c.id, c.name, c.document, c.email, c.phone, c.address, c.city, c.state, c.active ? "Sim" : "Não"]),
    );
  } else if (entity === "fornecedores") {
    const list = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
    csv = buildCsv(
      ["ID", "Razão Social / Nome", "CNPJ/CPF", "E-mail", "Telefone", "Endereço", "Cidade", "UF", "Ativo"],
      list.map((s) => [s.id, s.name, s.document, s.email, s.phone, s.address, s.city, s.state, s.active ? "Sim" : "Não"]),
    );
  } else if (entity === "produtos") {
    const list = await prisma.product.findMany({ orderBy: { name: "asc" }, include: { supplier: true } });
    csv = buildCsv(
      ["ID", "SKU", "Nome", "Categoria", "Unidade", "Preço Custo", "Preço Venda", "Estoque", "Estoque Mínimo", "Fornecedor", "Ativo"],
      list.map((p) => [
        p.id,
        p.sku,
        p.name,
        p.category,
        p.unit,
        p.costPrice.toFixed(2).replace(".", ","),
        p.salePrice.toFixed(2).replace(".", ","),
        String(p.stock).replace(".", ","),
        String(p.minStock).replace(".", ","),
        p.supplier?.name ?? "",
        p.active ? "Sim" : "Não",
      ]),
    );
  } else if (entity === "vendas") {
    const list = await prisma.sale.findMany({
      orderBy: [{ date: "desc" }, { id: "desc" }],
      include: { client: true, user: true },
    });
    csv = buildCsv(
      ["Nº", "Data", "Cliente", "Vendedor", "Forma de Pagamento", "Subtotal", "Desconto", "Total", "Status"],
      list.map((s) => [
        s.id,
        fmtDate(s.date),
        s.client?.name ?? "Consumidor final",
        s.user?.name ?? "",
        s.paymentMethod ?? "",
        s.subtotal.toFixed(2).replace(".", ","),
        s.discount.toFixed(2).replace(".", ","),
        s.total.toFixed(2).replace(".", ","),
        STATUS_LABEL[s.status] ?? s.status,
      ]),
    );
  } else if (entity === "compras") {
    const list = await prisma.purchase.findMany({
      orderBy: [{ date: "desc" }, { id: "desc" }],
      include: { supplier: true },
    });
    csv = buildCsv(
      ["Nº", "Data", "Fornecedor", "Vencimento", "Recebida em", "Total", "Status"],
      list.map((p) => [
        p.id,
        fmtDate(p.date),
        p.supplier?.name ?? "",
        fmtDate(p.dueDate),
        p.receivedAt ? fmtDateTime(p.receivedAt) : "",
        p.total.toFixed(2).replace(".", ","),
        STATUS_LABEL[p.status] ?? p.status,
      ]),
    );
  } else if (entity === "os") {
    const list = await prisma.serviceOrder.findMany({
      orderBy: [{ openedAt: "desc" }, { id: "desc" }],
      include: { client: true, technician: true },
    });
    csv = buildCsv(
      ["OS", "Abertura", "Cliente", "Equipamento", "Nº Série", "Técnico", "Prioridade", "Status", "Peças", "Mão de Obra", "Desconto", "Total"],
      list.map((o) => [
        o.id,
        fmtDate(o.openedAt),
        o.client?.name ?? "Avulso",
        o.equipment,
        o.serialNumber ?? "",
        o.technician?.name ?? "",
        STATUS_LABEL[o.priority] ?? o.priority,
        STATUS_LABEL[o.status] ?? o.status,
        o.partsSubtotal.toFixed(2).replace(".", ","),
        o.laborCost.toFixed(2).replace(".", ","),
        o.discount.toFixed(2).replace(".", ","),
        o.total.toFixed(2).replace(".", ","),
      ]),
    );
  } else if (entity === "financeiro") {
    const list = await prisma.financialEntry.findMany({ orderBy: [{ dueDate: "desc" }, { id: "desc" }] });
    csv = buildCsv(
      ["ID", "Vencimento", "Tipo", "Descrição", "Categoria", "Valor", "Status", "Pago em"],
      list.map((e) => [
        e.id,
        fmtDate(e.dueDate),
        STATUS_LABEL[e.type] ?? e.type,
        e.description,
        e.category ?? "",
        e.amount.toFixed(2).replace(".", ","),
        STATUS_LABEL[e.status] ?? e.status,
        e.paidAt ? fmtDateTime(e.paidAt) : "",
      ]),
    );
  } else if (entity === "funcionarios") {
    const list = await prisma.employee.findMany({ orderBy: { name: "asc" } });
    csv = buildCsv(
      ["ID", "Nome", "CPF", "Cargo", "Departamento", "E-mail", "Telefone", "Admissão", "Salário", "Ativo"],
      list.map((e) => [
        e.id,
        e.name,
        e.document ?? "",
        e.position,
        e.department ?? "",
        e.email ?? "",
        e.phone ?? "",
        fmtDate(e.hireDate),
        e.salary.toFixed(2).replace(".", ","),
        e.active ? "Sim" : "Não",
      ]),
    );
  } else if (entity === "auditoria") {
    const list = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 1000 });
    csv = buildCsv(
      ["ID", "Data/Hora", "Usuário", "Módulo", "Ação", "Reg. ID", "Detalhes"],
      list.map((a) => [a.id, fmtDateTime(a.createdAt), a.userName, a.module, a.action, a.entityId ?? "", a.details]),
    );
  } else {
    return new NextResponse("Entidade inválida", { status: 400 });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
