/**
 * Parser de arquivos de extrato bancário no padrão OFX (Open Financial Exchange)
 * compatível com Itaú, Bradesco, Banco do Brasil, Santander, Caixa, Sicredi, Nubank, Inter e Cora.
 */

export type OfxTransaction = {
  fitId: string;
  date: string; // YYYY-MM-DD
  amount: number; // valor absoluto positivo
  type: "RECEITA" | "DESPESA";
  description: string;
};

export type ParsedOfxStatement = {
  bankId?: string;
  accountId?: string;
  transactions: OfxTransaction[];
};

function getOfxTag(block: string, tag: string): string {
  // Suporta tanto <TAG>valor</TAG> quanto <TAG>valor\n (SGML OFX 1.x)
  const closedRegex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const closedMatch = block.match(closedRegex);
  if (closedMatch) return closedMatch[1].trim();

  const openRegex = new RegExp(`<${tag}>([^\\r\\n<]+)`, "i");
  const openMatch = block.match(openRegex);
  return openMatch ? openMatch[1].trim() : "";
}

function parseOfxDate(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return new Date().toISOString().slice(0, 10);
}

export function parseOfxContent(ofxText: string): ParsedOfxStatement {
  const clean = ofxText.trim();
  if (!clean.toUpperCase().includes("OFX") && !clean.toUpperCase().includes("<STMTTRN>")) {
    throw new Error("O arquivo enviado não parece ser um extrato bancário .OFX válido.");
  }

  const bankId = getOfxTag(clean, "BANKID");
  const accountId = getOfxTag(clean, "ACCTID");

  // Divide pelos blocos <STMTTRN>
  const parts = clean.split(/<STMTTRN>/i).slice(1);
  const transactions: OfxTransaction[] = [];

  parts.forEach((rawPart, idx) => {
    const block = rawPart.split(/<\/STMTTRN>/i)[0] || rawPart;
    const rawAmt = getOfxTag(block, "TRNAMT").replace(",", ".");
    const numAmt = parseFloat(rawAmt);
    if (isNaN(numAmt) || numAmt === 0) return;

    const dtPosted = getOfxTag(block, "DTPOSTED");
    const fitId = getOfxTag(block, "FITID") || `OFX-${idx + 1}-${dtPosted}`;
    const memo = getOfxTag(block, "MEMO");
    const name = getOfxTag(block, "NAME");
    const description = [memo, name].filter(Boolean).join(" — ") || `Transação Bancária #${idx + 1}`;

    transactions.push({
      fitId,
      date: parseOfxDate(dtPosted),
      amount: Number(Math.abs(numAmt).toFixed(2)),
      type: numAmt > 0 ? "RECEITA" : "DESPESA",
      description,
    });
  });

  if (transactions.length === 0) {
    throw new Error("Nenhuma transação (<STMTTRN>) foi localizada no extrato OFX.");
  }

  return {
    bankId: bankId || undefined,
    accountId: accountId || undefined,
    transactions,
  };
}

export function generateSampleOfx(): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKACCTFROM>
          <BANKID>0341</BANKID>
          <ACCTID>12345-6</ACCTID>
          <ACCTTYPE>CHECKING</ACCTTYPE>
        </BANKACCTFROM>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>CREDIT</TRNTYPE>
            <DTPOSTED>${today}100000[-3:BRT]</DTPOSTED>
            <TRNAMT>1849.80</TRNAMT>
            <FITID>FIT-${today}-001</FITID>
            <MEMO>RECEBIMENTO PIX / BOLETO CLIENTE</MEMO>
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>${today}140000[-3:BRT]</DTPOSTED>
            <TRNAMT>-380.00</TRNAMT>
            <FITID>FIT-${today}-002</FITID>
            <MEMO>PAGTO ENERGIA ELETRICA ENEL</MEMO>
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>${today}160000[-3:BRT]</DTPOSTED>
            <TRNAMT>-149.90</TRNAMT>
            <FITID>FIT-${today}-003</FITID>
            <MEMO>INTERNET FIBra EMPRESARIAL</MEMO>
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;
}
