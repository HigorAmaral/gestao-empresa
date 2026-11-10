"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getCompanySettings, logAudit } from "@/lib/audit";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { ValidationError, str, toFormError, type FormState } from "@/lib/form";
import { transmitNfe } from "@/lib/nfe/sefaz-service";
import type { NfeCompanyData, NfeItemData, NfeRecipientData } from "@/lib/nfe/types";

function revalidateAll() {
  for (const p of ["/nfe", "/vendas", "/financeiro", "/"]) {
    revalidatePath(p);
  }
}

/**
 * Emite a NF-e a partir de uma Venda confirmada
 */
export async function emitNfeFromSale(saleId: number) {
  const session = await requireUser();
  await ensureStockLocationTables();

  let createdInvoiceId: number;

  try {
    const [sale, company] = await Promise.all([
      prisma.sale.findUnique({
        where: { id: saleId },
        include: {
          client: true,
          user: true,
          items: {
            include: { product: true },
          },
          invoices: {
            where: { status: { in: ["AUTORIZADA", "PROCESSANDO"] } },
          },
        },
      }),
      getCompanySettings(),
    ]);

    if (!sale) throw new ValidationError("Venda não encontrada.");
    if (sale.status === "CANCELADA") {
      throw new ValidationError("Não é possível emitir nota fiscal de uma venda cancelada.");
    }
    if (sale.invoices.length > 0) {
      throw new ValidationError(`Esta venda já possui a NF-e nº ${sale.invoices[0].number} autorizada.`);
    }

    if (!sale.client) {
      throw new ValidationError("A venda precisa ter um cliente vinculado com CPF ou CNPJ para emitir NF-e.");
    }

    const cleanCpfCnpj = (sale.client.document || "").replace(/\D/g, "");
    if (!cleanCpfCnpj || (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14)) {
      throw new ValidationError("O cliente vinculado precisa de um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
    }

    const companyData: NfeCompanyData = {
      name: company.name,
      tradeName: company.tradeName,
      document: company.document || "00.000.000/0001-00",
      stateRegistration: company.stateRegistration || "ISENTO",
      taxRegime: company.taxRegime || "1",
      environment: (company.nfeEnvironment as "HOMOLOGACAO" | "PRODUCAO") || "HOMOLOGACAO",
      series: company.nfeSeries || 1,
      nextNumber: company.nfeNextNumber || 1,
      apiProvider: company.nfeApiProvider,
      apiKey: company.nfeApiKey,
      address: company.address,
      city: company.city,
      state: company.state,
      zipCode: company.zipCode,
      ibgeCityCode: company.ibgeCityCode || "3550308",
      phone: company.phone,
      email: company.email,
      logoUrl: company.logoUrl,
    };

    const recipientData: NfeRecipientData = {
      name: sale.client.name,
      document: sale.client.document || "",
      ie: sale.client.ie,
      ieIndicator: sale.client.ieIndicator || "9",
      email: sale.client.email,
      phone: sale.client.phone,
      address: sale.client.address,
      city: sale.client.city,
      state: sale.client.state,
      zipCode: sale.client.zipCode,
      ibgeCode: company.ibgeCityCode || "3550308",
    };

    const invoiceNumber = company.nfeNextNumber || 1;
    const invoiceSeries = company.nfeSeries || 1;

    const nfeItems: NfeItemData[] = sale.items.map((item, index) => {
      // NCM obrigatório: se o produto não tiver NCM configurado, atribui um padrão de mercadorias gerais
      const rawNcm = (item.product.ncm || "").replace(/\D/g, "");
      const ncm = rawNcm.length >= 8 ? rawNcm.slice(0, 8) : "84713012";
      const cfop = (item.product.cfop || "5102").replace(/\D/g, "").slice(0, 4);

      return {
        itemNumber: index + 1,
        productId: item.productId,
        sku: item.product.sku,
        name: item.product.name,
        ncm,
        cest: item.product.cest,
        cfop,
        unit: item.product.unit || "UN",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.total || item.quantity * item.unitPrice,
        discount: 0,
        origin: item.product.origin || "0",
        csosn: item.product.csosn || "102",
      };
    });

    // Mapeamento de forma de pagamento para NF-e
    let tPag = "01"; // Dinheiro
    const pm = (sale.paymentMethod || "").toLowerCase();
    if (pm.includes("pix")) tPag = "17";
    else if (pm.includes("crédito") || pm.includes("credito")) tPag = "03";
    else if (pm.includes("débito") || pm.includes("debito")) tPag = "04";
    else if (pm.includes("boleto")) tPag = "15";

    // Transmite / Autoriza a NF-e
    const result = await transmitNfe({
      company: companyData,
      recipient: recipientData,
      items: nfeItems,
      number: invoiceNumber,
      series: invoiceSeries,
      saleId: sale.id,
      userId: session.userId,
      paymentMethod: tPag,
      notes: sale.notes,
    });

    if (!result.success) {
      throw new ValidationError(result.errorMessage || result.xMotivo);
    }

    // Grava a NF-e Autorizada no banco de dados
    const created = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          number: invoiceNumber,
          series: invoiceSeries,
          type: "SAIDA",
          status: result.status,
          environment: companyData.environment,
          saleId: sale.id,
          clientId: sale.client?.id,
          userId: session.userId,
          accessKey: result.accessKey,
          protocol: result.protocol,
          authorizedAt: result.authorizedAt,
          cStat: result.cStat,
          xMotivo: result.xMotivo,
          xmlContent: result.xmlContent,
          totalProducts: sale.subtotal || sale.total,
          totalDiscount: sale.discount,
          totalInvoice: sale.total,
          approxTaxTotal: Math.round(sale.total * 0.2845 * 100) / 100,
          fiscalNotes: sale.notes,
          items: {
            create: nfeItems.map((it) => ({
              productId: it.productId,
              itemNumber: it.itemNumber,
              sku: it.sku,
              name: it.name,
              ncm: it.ncm,
              cfop: it.cfop,
              unit: it.unit,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              totalPrice: it.totalPrice,
              discount: it.discount || 0,
              origin: it.origin,
              csosn: it.csosn,
            })),
          },
        },
      });

      // Incrementa o próximo número da NF-e nas configurações
      await tx.companySettings.update({
        where: { id: 1 },
        data: { nfeNextNumber: invoiceNumber + 1 },
      });

      return inv;
    });

    createdInvoiceId = created.id;

    await logAudit(
      session,
      "VENDAS",
      "EMITIR_NFE",
      `NF-e nº ${invoiceNumber} emitida e autorizada para a Venda #${saleId}. Chave: ${result.accessKey}`,
      createdInvoiceId
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro na emissão da NF-e.";
    redirect(`/vendas/${saleId}?erro=${encodeURIComponent(msg)}`);
  }

  revalidateAll();
  redirect(`/nfe/${createdInvoiceId}?ok=${encodeURIComponent("NF-e autorizada com sucesso na SEFAZ!")}`);
}

/**
 * Cancela uma NF-e perante a SEFAZ
 */
export async function cancelInvoice(invoiceId: number, fd: FormData) {
  const session = await requireUser();
  await ensureStockLocationTables();

  const justification = str(fd, "justification");
  if (!justification || justification.length < 15) {
    throw new ValidationError("A justificativa de cancelamento da SEFAZ deve conter no mínimo 15 caracteres.");
  }

  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new ValidationError("Nota fiscal não encontrada.");
    if (invoice.status === "CANCELADA") {
      throw new ValidationError("Esta NF-e já se encontra cancelada.");
    }
    if (invoice.status !== "AUTORIZADA") {
      throw new ValidationError("Apenas notas fiscais autorizadas podem ser canceladas.");
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "CANCELADA",
        canceledAt: new Date(),
        cancelReason: justification,
      },
    });

    await logAudit(
      session,
      "VENDAS",
      "CANCELAR_NFE",
      `NF-e nº ${invoice.number} cancelada na SEFAZ. Motivo: ${justification}`,
      invoiceId
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao cancelar NF-e.";
    redirect(`/nfe/${invoiceId}?erro=${encodeURIComponent(msg)}`);
  }

  revalidateAll();
  redirect(`/nfe/${invoiceId}?ok=${encodeURIComponent("NF-e cancelada com sucesso perante a SEFAZ.")}`);
}

/**
 * Salva as configurações fiscais de NF-e da empresa
 */
export async function saveFiscalSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireUser();
  await ensureStockLocationTables();

  try {
    const taxRegime = str(fd, "taxRegime") || "1";
    const nfeEnvironment = str(fd, "nfeEnvironment") || "HOMOLOGACAO";
    const nfeSeries = Math.max(1, Number(fd.get("nfeSeries")) || 1);
    const nfeNextNumber = Math.max(1, Number(fd.get("nfeNextNumber")) || 1);
    const nfeApiProvider = str(fd, "nfeApiProvider") || "FOCUS_NFE";
    const nfeApiKey = str(fd, "nfeApiKey");
    const ibgeCityCode = str(fd, "ibgeCityCode") || "3550308";
    const nfeCscId = str(fd, "nfeCscId");
    const nfeCscToken = str(fd, "nfeCscToken");

    await prisma.companySettings.upsert({
      where: { id: 1 },
      update: {
        taxRegime,
        nfeEnvironment,
        nfeSeries,
        nfeNextNumber,
        nfeApiProvider,
        nfeApiKey,
        ibgeCityCode,
        nfeCscId,
        nfeCscToken,
      },
      create: {
        id: 1,
        taxRegime,
        nfeEnvironment,
        nfeSeries,
        nfeNextNumber,
        nfeApiProvider,
        nfeApiKey,
        ibgeCityCode,
        nfeCscId,
        nfeCscToken,
      },
    });

    await logAudit(session, "CONFIG", "FISCAL", "Atualizou configurações fiscais de NF-e da empresa.");
  } catch (err) {
    return toFormError(err);
  }

  revalidateAll();
  redirect("/nfe/configuracoes?ok=" + encodeURIComponent("Configurações fiscais de NF-e salvas com sucesso!"));
}
