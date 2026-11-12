/**
 * Parser completo de XML de NF-e Modelo 55 (SEFAZ 4.00) para importação automática
 * de Compras, Recebimento de Mercadorias, Cadastro de Fornecedor, Produtos e Contas a Pagar.
 */

export type ParsedNfeSupplier = {
  cnpj: string;
  name: string;
  tradeName?: string;
  ie?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
};

export type ParsedNfeItem = {
  itemNumber: number;
  code: string;
  ean?: string;
  name: string;
  ncm: string;
  cest?: string;
  cfop: string;
  unit: string;
  quantity: number;
  unitCost: number;
  total: number;
};

export type ParsedNfeDuplicate = {
  number: string;
  dueDate: string; // YYYY-MM-DD
  amount: number;
};

export type ParsedNfeDocument = {
  accessKey: string;
  number: string;
  series: string;
  issueDate: string; // YYYY-MM-DD
  totalProducts: number;
  totalInvoice: number;
  supplier: ParsedNfeSupplier;
  items: ParsedNfeItem[];
  duplicates: ParsedNfeDuplicate[];
};

function getTag(xml: string, tag: string): string {
  const regex = new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function getAllBlocks(xml: string, tag: string): string[] {
  const regex = new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, "gi");
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

function formatCnpj(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
  }
  return digits;
}

export function parseNfeXml(xmlText: string): ParsedNfeDocument {
  const clean = xmlText.trim();
  if (!clean.includes("<NFe") && !clean.includes("<nfeProc") && !clean.includes("<infNFe")) {
    throw new Error("O arquivo enviado não parece ser um XML válido de NF-e (Modelo 55).");
  }

  // Chave de acesso
  const chNFe = getTag(clean, "chNFe");
  const infNFeIdMatch = clean.match(/Id=["']NFe(\d{44})["']/i);
  const accessKey = chNFe || (infNFeIdMatch ? infNFeIdMatch[1] : "");

  // Bloco <ide>
  const ideBlock = getTag(clean, "ide");
  const number = getTag(ideBlock, "nNF") || "1";
  const series = getTag(ideBlock, "serie") || "1";
  const dhEmi = getTag(ideBlock, "dhEmi") || getTag(ideBlock, "dEmi");
  const issueDate = dhEmi ? dhEmi.slice(0, 10) : new Date().toISOString().slice(0, 10);

  // Bloco <emit> (Fornecedor)
  const emitBlock = getTag(clean, "emit");
  const enderEmit = getTag(emitBlock, "enderEmit");
  const rawCnpj = getTag(emitBlock, "CNPJ") || getTag(emitBlock, "CPF");
  const xNome = getTag(emitBlock, "xNome") || "Fornecedor NF-e";
  const xFant = getTag(emitBlock, "xFant");
  const ie = getTag(emitBlock, "IE");
  const email = getTag(emitBlock, "email");

  const xLgr = getTag(enderEmit, "xLgr");
  const nro = getTag(enderEmit, "nro");
  const xBairro = getTag(enderEmit, "xBairro");
  const xMun = getTag(enderEmit, "xMun");
  const uf = getTag(enderEmit, "UF");
  const cep = getTag(enderEmit, "CEP");
  const fone = getTag(enderEmit, "fone");

  const addressParts = [xLgr, nro, xBairro].filter(Boolean);

  const supplier: ParsedNfeSupplier = {
    cnpj: formatCnpj(rawCnpj),
    name: xNome,
    tradeName: xFant || undefined,
    ie: ie || undefined,
    phone: fone || undefined,
    email: email || undefined,
    address: addressParts.length > 0 ? addressParts.join(", ") : undefined,
    city: xMun || undefined,
    state: uf || undefined,
    zipCode: cep || undefined,
  };

  // Itens <det>
  const detBlocks = getAllBlocks(clean, "det");
  const items: ParsedNfeItem[] = detBlocks.map((det, idx) => {
    const prod = getTag(det, "prod");
    const cProd = getTag(prod, "cProd") || `ITEM-${idx + 1}`;
    const cEAN = getTag(prod, "cEAN");
    const xProd = getTag(prod, "xProd") || `Produto Importado #${idx + 1}`;
    const ncm = getTag(prod, "NCM") || "00000000";
    const cest = getTag(prod, "CEST");
    const cfop = getTag(prod, "CFOP") || "1102";
    const uCom = (getTag(prod, "uCom") || "UN").toUpperCase().slice(0, 6);
    const qCom = parseFloat(getTag(prod, "qCom") || "1") || 1;
    const vUnCom = parseFloat(getTag(prod, "vUnCom") || "0") || 0;
    const vProd = parseFloat(getTag(prod, "vProd") || String(qCom * vUnCom)) || 0;

    return {
      itemNumber: idx + 1,
      code: cProd,
      ean: cEAN && cEAN !== "SEM GTIN" ? cEAN : undefined,
      name: xProd,
      ncm,
      cest: cest || undefined,
      cfop,
      unit: uCom,
      quantity: Number(qCom.toFixed(4)),
      unitCost: Number(vUnCom.toFixed(2)),
      total: Number(vProd.toFixed(2)),
    };
  });

  if (items.length === 0) {
    throw new Error("Nenhum item (<det><prod>) foi encontrado dentro do XML da NF-e.");
  }

  // Totais <ICMSTot>
  const icmsTot = getTag(clean, "ICMSTot");
  const itemsSum = items.reduce((acc, i) => acc + i.total, 0);
  const totalProducts = parseFloat(getTag(icmsTot, "vProd")) || itemsSum;
  const totalInvoice = parseFloat(getTag(icmsTot, "vNF")) || totalProducts;

  // Duplicatas / Parcelas <cobr><dup>
  const cobrBlock = getTag(clean, "cobr");
  const dupBlocks = cobrBlock ? getAllBlocks(cobrBlock, "dup") : [];
  const duplicates: ParsedNfeDuplicate[] = dupBlocks.map((dup, idx) => ({
    number: getTag(dup, "nDup") || String(idx + 1).padStart(3, "0"),
    dueDate: getTag(dup, "dVenc") || issueDate,
    amount: parseFloat(getTag(dup, "vDup") || "0") || 0,
  })).filter((d) => d.amount > 0);

  return {
    accessKey,
    number,
    series,
    issueDate,
    totalProducts: Number(totalProducts.toFixed(2)),
    totalInvoice: Number(totalInvoice.toFixed(2)),
    supplier,
    items,
    duplicates,
  };
}

/** Gera um XML NF-e Modelo 55 realista de exemplo para demonstração/teste rápido */
export function generateSampleSupplierXml(): string {
  const today = new Date().toISOString().slice(0, 10);
  const due1 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const due2 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe35261112345678000199550010000048211000482105" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <natOp>VENDA DE MERCADORIA</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>4821</nNF>
        <dhEmi>${today}T10:30:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>12345678000199</CNPJ>
        <xNome>DISTRIBUIDORA NACIONAL DE TECNOLOGIA E SUPRIMENTOS LTDA</xNome>
        <xFant>TECH DISTRIBUIDORA</xFant>
        <enderEmit>
          <xLgr>AV DAS NACOES UNIDAS</xLgr>
          <nro>12500</nro>
          <xBairro>BROOKLIN</xBairro>
          <xMun>SAO PAULO</xMun>
          <UF>SP</UF>
          <CEP>04578000</CEP>
          <fone>1134567890</fone>
        </enderEmit>
        <IE>110042490114</IE>
      </emit>
      <det nItem="1">
        <prod>
          <cProd>SSD-NVME-1TB</cProd>
          <cEAN>7891234560012</cEAN>
          <xProd>SSD NVMe M.2 1TB Gen4 Leitura 5000MB/s</xProd>
          <NCM>84717040</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>10.0000</qCom>
          <vUnCom>340.00</vUnCom>
          <vProd>3400.00</vProd>
        </prod>
      </det>
      <det nItem="2">
        <prod>
          <cProd>MEM-DDR4-16GB</cProd>
          <cEAN>7891234560029</cEAN>
          <xProd>Memoria RAM DDR4 16GB 3200MHz CL16</xProd>
          <NCM>84733042</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>15.0000</qCom>
          <vUnCom>190.00</vUnCom>
          <vProd>2850.00</vProd>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vProd>6250.00</vProd>
          <vNF>6250.00</vNF>
        </ICMSTot>
      </total>
      <cobr>
        <dup>
          <nDup>001</nDup>
          <dVenc>${due1}</dVenc>
          <vDup>3125.00</vDup>
        </dup>
        <dup>
          <nDup>002</nDup>
          <dVenc>${due2}</dVenc>
          <vDup>3125.00</vDup>
        </dup>
      </cobr>
    </infNFe>
  </NFe>
</nfeProc>`;
}
