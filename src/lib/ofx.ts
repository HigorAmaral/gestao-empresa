/**
 * Parser nativo de arquivos OFX (Open Financial Exchange 1.x e 2.x)
 * Compatível com extratos exportados por bancos brasileiros:
 * Itaú, Bradesco, Banco do Brasil, Santander, Caixa, Nubank, Inter, Sicredi, Sicoob, etc.
 */

export interface OfxTransaction {
  id: string;
  type: "CREDIT" | "DEBIT" | "OTHER";
  amount: number; // Positivo para crédito/receita, negativo para débito/despesa
  date: Date;
  memo: string;
}

export interface OfxParsedStatement {
  bankId?: string;
  accountId?: string;
  startDate?: Date;
  endDate?: Date;
  transactions: OfxTransaction[];
}

function parseOfxDate(dateStr: string): Date {
  const clean = dateStr.replace(/[^0-9]/g, "");
  if (clean.length >= 8) {
    const y = parseInt(clean.slice(0, 4), 10);
    const m = parseInt(clean.slice(4, 6), 10) - 1;
    const d = parseInt(clean.slice(6, 8), 10);
    return new Date(Date.UTC(y, m, d, 12, 0, 0));
  }
  return new Date();
}

function extractTagValue(xmlOrSgml: string, tagName: string): string | null {
  // Tenta formato XML fechado <TAG>valor</TAG>
  const xmlMatch = new RegExp(`<${tagName}>([^<]+)<\\/${tagName}>`, "i").exec(xmlOrSgml);
  if (xmlMatch) return xmlMatch[1].trim();

  // Tenta formato SGML clássico <TAG>valor\n (sem tag de fechamento)
  const sgmlMatch = new RegExp(`<${tagName}>([^\\r\\n<]+)`, "i").exec(xmlOrSgml);
  if (sgmlMatch) return sgmlMatch[1].trim();

  return null;
}

export function parseOfx(ofxContent: string): OfxParsedStatement {
  const bankId = extractTagValue(ofxContent, "BANKID") || undefined;
  const accountId = extractTagValue(ofxContent, "ACCTID") || undefined;

  const dtStartRaw = extractTagValue(ofxContent, "DTSTART");
  const dtEndRaw = extractTagValue(ofxContent, "DTEND");

  const startDate = dtStartRaw ? parseOfxDate(dtStartRaw) : undefined;
  const endDate = dtEndRaw ? parseOfxDate(dtEndRaw) : undefined;

  const transactions: OfxTransaction[] = [];

  // Encontra cada bloco <STMTTRN> ... </STMTTRN> ou <STMTTRN> ... (próximo <STMTTRN> ou </BANKTRANLIST>)
  const trnRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>|$))/gi;
  let match: RegExpExecArray | null;

  while ((match = trnRegex.exec(ofxContent)) !== null) {
    const block = match[1];
    const fitid = extractTagValue(block, "FITID") || `trn-${transactions.length + 1}`;
    const rawType = (extractTagValue(block, "TRNTYPE") || "").toUpperCase();
    const rawAmt = extractTagValue(block, "TRNAMT") || "0";
    const rawDate = extractTagValue(block, "DTPOSTED") || "";
    const memo = extractTagValue(block, "MEMO") || extractTagValue(block, "NAME") || "Transação Bancária";

    // Converte montante (substitui vírgula se houver)
    const amount = parseFloat(rawAmt.replace(",", "."));
    if (isNaN(amount) || amount === 0) continue;

    let type: "CREDIT" | "DEBIT" | "OTHER" = "OTHER";
    if (rawType === "CREDIT" || amount > 0) {
      type = "CREDIT";
    } else if (rawType === "DEBIT" || amount < 0) {
      type = "DEBIT";
    }

    transactions.push({
      id: fitid,
      type,
      amount: Math.abs(amount), // Guardamos o valor absoluto para comparar com `FinancialEntry.amount`
      date: rawDate ? parseOfxDate(rawDate) : new Date(),
      memo: memo.replace(/[\r\n\t]+/g, " ").trim(),
    });
  }

  return {
    bankId,
    accountId,
    startDate,
    endDate,
    transactions,
  };
}
