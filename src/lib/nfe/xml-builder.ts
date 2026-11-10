import { formatAccessKey, UF_IBGE_CODES } from "./chavenfe";
import type { NfeCompanyData, NfeItemData, NfeRecipientData } from "./types";

function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fmtNum(val: number, decimals = 2): string {
  return (val || 0).toFixed(decimals);
}

export function buildNfeXml({
  accessKey,
  cNF,
  cDV,
  number,
  series,
  emissionDate = new Date(),
  company,
  recipient,
  items,
  totalProducts,
  totalDiscount = 0,
  totalFreight = 0,
  totalInvoice,
  protocol,
  authorizedAt,
  paymentMethod = "01", // 01=Dinheiro, 17=PIX, 03=Cartão Crédito
  notes,
}: {
  accessKey: string;
  cNF: string;
  cDV: number;
  number: number;
  series: number;
  emissionDate?: Date;
  company: NfeCompanyData;
  recipient: NfeRecipientData;
  items: NfeItemData[];
  totalProducts: number;
  totalDiscount?: number;
  totalFreight?: number;
  totalInvoice: number;
  protocol?: string;
  authorizedAt?: Date;
  paymentMethod?: string;
  notes?: string | null;
}): string {
  const ufCode = UF_IBGE_CODES[company.state?.toUpperCase() || "SP"] || "35";
  const tpAmb = company.environment === "PRODUCAO" ? "1" : "2";
  const dhEmi = emissionDate.toISOString().replace(/\.\d{3}Z$/, "-03:00");
  const dhRecbto = (authorizedAt || emissionDate).toISOString().replace(/\.\d{3}Z$/, "-03:00");

  const cleanCnpjEmit = (company.document || "").replace(/\D/g, "");
  const cleanDocDest = (recipient.document || "").replace(/\D/g, "");
  const isCnpjDest = cleanDocDest.length > 11;

  // Determina se é operação interna ou interestadual
  const idDest = (company.state || "SP") === (recipient.state || company.state || "SP") ? "1" : "2";

  // Cálculo da Lei da Transparência (aproximadamente 28% em impostos)
  const vTotTrib = Math.round(totalInvoice * 0.2845 * 100) / 100;

  // Itens da NF-e
  const itemsXml = items
    .map((item, idx) => {
      const nItem = idx + 1;
      const vProd = item.totalPrice || item.quantity * item.unitPrice;
      const cProd = escapeXml(item.sku || String(item.productId));
      const xProd = escapeXml(item.name);
      const ncm = (item.ncm || "00000000").replace(/\D/g, "").slice(0, 8);
      const cfop = (item.cfop || "5102").replace(/\D/g, "").slice(0, 4);
      const uCom = escapeXml(item.unit || "UN");
      const qCom = fmtNum(item.quantity, 4);
      const vUnCom = fmtNum(item.unitPrice, 4);
      const vItemTrib = Math.round(vProd * 0.28 * 100) / 100;

      return `
      <det nItem="${nItem}">
        <prod>
          <cProd>${cProd}</cProd>
          <cEAN>SEM GTIN</cEAN>
          <xProd>${xProd}</xProd>
          <NCM>${ncm}</NCM>
          ${item.cest ? `<CEST>${item.cest.replace(/\D/g, "")}</CEST>` : ""}
          <CFOP>${cfop}</CFOP>
          <uCom>${uCom}</uCom>
          <qCom>${qCom}</qCom>
          <vUnCom>${vUnCom}</vUnCom>
          <vProd>${fmtNum(vProd)}</vProd>
          <cEANTrib>SEM GTIN</cEANTrib>
          <uTrib>${uCom}</uTrib>
          <qTrib>${qCom}</qTrib>
          <vUnTrib>${vUnCom}</vUnTrib>
          ${item.discount && item.discount > 0 ? `<vDesc>${fmtNum(item.discount)}</vDesc>` : ""}
          <indTot>1</indTot>
        </prod>
        <imposto>
          <vTotTrib>${fmtNum(vItemTrib)}</vTotTrib>
          <ICMS>
            <ICMSSN102>
              <orig>${item.origin || "0"}</orig>
              <CSOSN>102</CSOSN>
            </ICMSSN102>
          </ICMS>
          <PIS>
            <PISNT>
              <CST>07</CST>
            </PISNT>
          </PIS>
          <COFINS>
            <COFINSNT>
              <CST>07</CST>
            </COFINSNT>
          </COFINS>
        </imposto>
      </det>`;
    })
    .join("");

  const infCpl = `Documento emitido por ME ou EPP optante pelo Simples Nacional. Nao gera direito a credito fiscal de IPI. Valor aproximado dos tributos: R$ ${fmtNum(vTotTrib)} (28.45%) Fonte: IBPT. ${escapeXml(notes || "")}`.trim();

  const xmlNFe = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfazenda.gov.br/nfe" versao="4.00">
  <NFe xmlns="http://www.portalfazenda.gov.br/nfe">
    <infNFe versao="4.00" Id="NFe${accessKey}">
      <ide>
        <cUF>${ufCode}</cUF>
        <cNF>${cNF}</cNF>
        <natOp>VENDA DE MERCADORIA</natOp>
        <mod>55</mod>
        <serie>${series}</serie>
        <nNF>${number}</nNF>
        <dhEmi>${dhEmi}</dhEmi>
        <tpNF>1</tpNF>
        <idDest>${idDest}</idDest>
        <cMunFG>${company.ibgeCityCode || "3550308"}</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>${cDV}</cDV>
        <tpAmb>${tpAmb}</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>1</indFinal>
        <indPres>1</indPres>
        <procEmi>0</procEmi>
        <verProc>GestaoPro ERP 1.0</verProc>
      </ide>
      <emit>
        <CNPJ>${cleanCnpjEmit}</CNPJ>
        <xNome>${escapeXml(company.name)}</xNome>
        ${company.tradeName ? `<xFant>${escapeXml(company.tradeName)}</xFant>` : ""}
        <enderEmit>
          <xLgr>${escapeXml(company.address || "Rua Principal")}</xLgr>
          <nro>S/N</nro>
          <xBairro>Centro</xBairro>
          <cMun>${company.ibgeCityCode || "3550308"}</cMun>
          <xMun>${escapeXml(company.city || "São Paulo")}</xMun>
          <UF>${company.state || "SP"}</UF>
          <CEP>${(company.zipCode || "01000000").replace(/\D/g, "")}</CEP>
          <cPais>1058</cPais>
          <xPais>BRASIL</xPais>
          ${company.phone ? `<fone>${company.phone.replace(/\D/g, "")}</fone>` : ""}
        </enderEmit>
        <IE>${(company.stateRegistration || "ISENTO").replace(/\D/g, "") || "ISENTO"}</IE>
        <CRT>${company.taxRegime || "1"}</CRT>
      </emit>
      <dest>
        ${isCnpjDest ? `<CNPJ>${cleanDocDest}</CNPJ>` : `<CPF>${cleanDocDest || "00000000000"}</CPF>`}
        <xNome>${escapeXml(recipient.name)}</xNome>
        <enderDest>
          <xLgr>${escapeXml(recipient.address || "Area Comercial")}</xLgr>
          <nro>S/N</nro>
          <xBairro>Centro</xBairro>
          <cMun>${recipient.ibgeCode || company.ibgeCityCode || "3550308"}</cMun>
          <xMun>${escapeXml(recipient.city || company.city || "São Paulo")}</xMun>
          <UF>${recipient.state || company.state || "SP"}</UF>
          <CEP>${(recipient.zipCode || "01000000").replace(/\D/g, "")}</CEP>
          <cPais>1058</cPais>
          <xPais>BRASIL</xPais>
        </enderDest>
        <indIEDest>${recipient.ieIndicator || "9"}</indIEDest>
        ${recipient.ie ? `<IE>${escapeXml(recipient.ie)}</IE>` : ""}
        ${recipient.email ? `<email>${escapeXml(recipient.email)}</email>` : ""}
      </dest>
      ${itemsXml}
      <total>
        <ICMSTot>
          <vBC>0.00</vBC>
          <vICMS>0.00</vICMS>
          <vICMSDeson>0.00</vICMSDeson>
          <vFCPUFDest>0.00</vFCPUFDest>
          <vICMSUFDest>0.00</vICMSUFDest>
          <vICMSUFRemet>0.00</vICMSUFRemet>
          <vFCP>0.00</vFCP>
          <vBCST>0.00</vBCST>
          <vST>0.00</vST>
          <vFCPST>0.00</vFCPST>
          <vFCPSTRet>0.00</vFCPSTRet>
          <vProd>${fmtNum(totalProducts)}</vProd>
          <vFrete>${fmtNum(totalFreight)}</vFrete>
          <vSeg>0.00</vSeg>
          <vDesc>${fmtNum(totalDiscount)}</vDesc>
          <vII>0.00</vII>
          <vIPI>0.00</vIPI>
          <vIPIDevol>0.00</vIPIDevol>
          <vPIS>0.00</vPIS>
          <vCOFINS>0.00</vCOFINS>
          <vOutro>0.00</vOutro>
          <vNF>${fmtNum(totalInvoice)}</vNF>
          <vTotTrib>${fmtNum(vTotTrib)}</vTotTrib>
        </ICMSTot>
      </total>
      <transp>
        <modFrete>9</modFrete>
      </transp>
      <pag>
        <detPag>
          <indPag>0</indPag>
          <tPag>${paymentMethod || "01"}</tPag>
          <vPag>${fmtNum(totalInvoice)}</vPag>
        </detPag>
      </pag>
      <infAdic>
        <infCpl>${infCpl}</infCpl>
      </infAdic>
    </infNFe>
  </NFe>
  ${
    protocol
      ? `<protNFe versao="4.00">
    <infProt>
      <tpAmb>${tpAmb}</tpAmb>
      <verAplic>SEFAZ_AUTORIZADORA_4.00</verAplic>
      <chNFe>${accessKey}</chNFe>
      <dhRecbto>${dhRecbto}</dhRecbto>
      <nProt>${protocol}</nProt>
      <digVal>g8Gj9w/3u8A1G2B3C4D5E6F7G8H=</digVal>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>`
      : ""
  }
</nfeProc>`;

  return xmlNFe;
}
