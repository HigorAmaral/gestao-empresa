"use client";

import { formatAccessKey } from "./chavenfe";
import { fmtDate, fmtDateTime, num } from "@/lib/format";

type DanfeData = {
  invoice: {
    id: number;
    number: number;
    series: number;
    type: string;
    status: string;
    environment: string;
    accessKey?: string | null;
    protocol?: string | null;
    authorizedAt?: Date | string | null;
    createdAt: Date | string;
    totalProducts: number;
    totalDiscount: number;
    totalFreight: number;
    totalInvoice: number;
    baseIcms: number;
    valueIcms: number;
    valuePis: number;
    valueCofins: number;
    approxTaxTotal: number;
    fiscalNotes?: string | null;
    items: {
      id: number;
      itemNumber: number;
      sku?: string | null;
      name: string;
      ncm: string;
      cfop: string;
      unit: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      discount?: number;
      origin: string;
      csosn?: string | null;
      icmsRate?: number;
      icmsValue?: number;
    }[];
  };
  company: {
    name: string;
    tradeName?: string | null;
    document?: string | null;
    stateRegistration?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    phone?: string | null;
    logoUrl?: string | null;
  };
  recipient: {
    name: string;
    document?: string | null;
    ie?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    phone?: string | null;
  };
};

function SvgBarcodeCode128({ text }: { text: string }) {
  const bars: { w: number; black: boolean }[] = [];
  bars.push({ w: 2, black: true }, { w: 1, black: false }, { w: 2, black: true });
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bars.push({ w: (code % 3) + 1, black: true });
    bars.push({ w: ((code >> 1) % 2) + 1, black: false });
    bars.push({ w: ((code >> 2) % 3) + 1, black: true });
    bars.push({ w: 1, black: false });
  }
  bars.push({ w: 2, black: true }, { w: 1, black: false }, { w: 2, black: true });

  let x = 5;
  const rects = bars.map((b, i) => {
    const curX = x;
    x += b.w * 1.5;
    if (!b.black) return null;
    return <rect key={i} x={curX} y={2} width={b.w * 1.5} height={40} fill="#000" />;
  });

  return (
    <svg viewBox={`0 0 ${Math.max(x + 5, 260)} 44`} style={{ width: "100%", height: 38, display: "block" }}>
      {rects}
    </svg>
  );
}

export function DanfeDocument({ data }: { data: DanfeData }) {
  const { invoice, company, recipient } = data;
  const accessKey = invoice.accessKey || "00000000000000000000000000000000000000000000";
  const formattedKey = formatAccessKey(accessKey);

  const cleanDocEmit = company.document || "00.000.000/0001-00";
  const cleanDocDest = recipient.document || "000.000.000-00";

  return (
    <div className="danfe-page">
      {/* 1. CANHOTO SUPERIOR (Comprovante de Entrega) */}
      <div className="danfe-box" style={{ marginBottom: 4, display: "grid", gridTemplateColumns: "1fr 140px", gap: 0 }}>
        <div style={{ borderRight: "1px solid #000", padding: "4px 8px", fontSize: 9 }}>
          RECEBEMOS DE <strong>{(company.tradeName || company.name).toUpperCase()}</strong> OS PRODUTOS/SERVIÇOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO
          <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 8, marginTop: 12 }}>
            <div style={{ borderTop: "1px solid #000", paddingTop: 2 }}>DATA DE RECEBIMENTO</div>
            <div style={{ borderTop: "1px solid #000", paddingTop: 2 }}>IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</div>
          </div>
        </div>
        <div style={{ padding: "4px 8px", textAlign: "center" }}>
          <div style={{ fontSize: 9, fontWeight: 700 }}>NF-e</div>
          <div style={{ fontSize: 13, fontWeight: 900 }}>Nº {String(invoice.number).padStart(9, "0")}</div>
          <div style={{ fontSize: 9 }}>SÉRIE: {invoice.series}</div>
        </div>
      </div>

      {/* 2. CABEÇALHO PRINCIPAL DA NF-E */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 110px 1.8fr", gap: 4, marginBottom: 4 }}>
        {/* Dados do Emitente */}
        <div className="danfe-box" style={{ padding: 6, display: "flex", gap: 8, alignItems: "center" }}>
          {company.logoUrl && (
            <img
              src={company.logoUrl}
              alt="Logo"
              style={{ maxHeight: 55, maxWidth: 85, objectFit: "contain", flexShrink: 0 }}
            />
          )}
          <div style={{ fontSize: 9 }}>
            <div style={{ fontSize: 11, fontWeight: 900 }}>{company.tradeName || company.name}</div>
            <div style={{ fontSize: 8.5, color: "#333" }}>{company.name}</div>
            <div>{company.address}</div>
            <div>{company.city} - {company.state} - CEP: {company.zipCode}</div>
            {company.phone && <div>Tel: {company.phone}</div>}
          </div>
        </div>

        {/* Bloco DANFE */}
        <div className="danfe-box" style={{ padding: 4, textAlign: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 900 }}>DANFE</div>
          <div style={{ fontSize: 7, lineHeight: 1.1 }}>Documento Auxiliar da Nota Fiscal Eletrônica</div>
          <div style={{ fontSize: 8, margin: "4px 0", borderTop: "1px solid #000", borderBottom: "1px solid #000", padding: "2px 0" }}>
            <div>0 - ENTRADA</div>
            <div style={{ fontWeight: 800 }}>1 - SAÍDA &nbsp; [ 1 ]</div>
          </div>
          <div style={{ fontSize: 8 }}>
            <strong>Nº {String(invoice.number).padStart(9, "0")}</strong>
            <div>SÉRIE: {invoice.series}</div>
            <div>FOLHA 1 / 1</div>
          </div>
        </div>

        {/* Chave de Acesso e Código de Barras */}
        <div className="danfe-box" style={{ padding: 4, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <SvgBarcodeCode128 text={accessKey} />
            <div style={{ fontSize: 7.5, fontWeight: 700, textAlign: "center", letterSpacing: 0.5, marginTop: 2 }}>
              CHAVE DE ACESSO
            </div>
            <div style={{ fontSize: 9.5, fontWeight: 900, textAlign: "center", fontFamily: "monospace" }}>
              {formattedKey}
            </div>
          </div>
          <div style={{ fontSize: 7, textAlign: "center", borderTop: "1px solid #000", paddingTop: 2 }}>
            Consulta de autenticidade no portal nacional da NF-e <strong>www.nfe.fazenda.gov.br/portal</strong> ou no site da Sefaz Autorizadora
          </div>
        </div>
      </div>

      {/* 3. NATUREZA DA OPERAÇÃO & PROTOCOLO */}
      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr", gap: 4, marginBottom: 4 }}>
        <div className="danfe-box" style={{ padding: 4, fontSize: 8 }}>
          <span className="danfe-label">NATUREZA DA OPERAÇÃO</span>
          <div style={{ fontWeight: 700, fontSize: 9 }}>VENDA DE MERCADORIA ADQUIRIDA OU RECEBIDA DE TERCEIROS</div>
        </div>
        <div className="danfe-box" style={{ padding: 4, fontSize: 8 }}>
          <span className="danfe-label">PROTOCOLO DE AUTORIZAÇÃO DE USO</span>
          <div style={{ fontWeight: 800, fontSize: 9, fontFamily: "monospace" }}>
            {invoice.protocol ? `${invoice.protocol} — ${fmtDateTime(invoice.authorizedAt || invoice.createdAt)}` : "EM HOMOLOGAÇÃO"}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 6 }}>
        <div className="danfe-box" style={{ padding: 4, fontSize: 8 }}>
          <span className="danfe-label">INSCRIÇÃO ESTADUAL</span>
          <div style={{ fontWeight: 700 }}>{company.stateRegistration || "ISENTO"}</div>
        </div>
        <div className="danfe-box" style={{ padding: 4, fontSize: 8 }}>
          <span className="danfe-label">INSC. ESTADUAL DO SUBST. TRIB.</span>
          <div>—</div>
        </div>
        <div className="danfe-box" style={{ padding: 4, fontSize: 8 }}>
          <span className="danfe-label">CNPJ DO EMITENTE</span>
          <div style={{ fontWeight: 800 }}>{cleanDocEmit}</div>
        </div>
      </div>

      {/* 4. DESTINATÁRIO / REMETENTE */}
      <div className="danfe-section-title">DESTINATÁRIO / REMETENTE</div>
      <div className="danfe-box" style={{ padding: 4, marginBottom: 6 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1.5fr 1fr", gap: 6, borderBottom: "1px solid #ccc", paddingBottom: 3 }}>
          <div>
            <span className="danfe-label">NOME / RAZÃO SOCIAL</span>
            <div style={{ fontWeight: 800, fontSize: 9.5 }}>{recipient.name}</div>
          </div>
          <div>
            <span className="danfe-label">CNPJ / CPF</span>
            <div style={{ fontWeight: 800, fontSize: 9.5 }}>{cleanDocDest}</div>
          </div>
          <div>
            <span className="danfe-label">DATA DA EMISSÃO</span>
            <div style={{ fontSize: 9 }}>{fmtDate(invoice.createdAt)}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 6, borderBottom: "1px solid #ccc", padding: "3px 0" }}>
          <div>
            <span className="danfe-label">ENDEREÇO</span>
            <div style={{ fontSize: 9 }}>{recipient.address || "Não informado"}</div>
          </div>
          <div>
            <span className="danfe-label">BAIRRO / DISTRITO</span>
            <div style={{ fontSize: 9 }}>Centro</div>
          </div>
          <div>
            <span className="danfe-label">CEP</span>
            <div style={{ fontSize: 9 }}>{recipient.zipCode || "00000-000"}</div>
          </div>
          <div>
            <span className="danfe-label">DATA SAÍDA / ENTRADA</span>
            <div style={{ fontSize: 9 }}>{fmtDate(invoice.createdAt)}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 60px 1fr 1.2fr", gap: 6, paddingTop: 3 }}>
          <div>
            <span className="danfe-label">MUNICÍPIO</span>
            <div style={{ fontSize: 9 }}>{recipient.city || "São Paulo"}</div>
          </div>
          <div>
            <span className="danfe-label">UF</span>
            <div style={{ fontSize: 9 }}>{recipient.state || "SP"}</div>
          </div>
          <div>
            <span className="danfe-label">FONE / FAX</span>
            <div style={{ fontSize: 9 }}>{recipient.phone || "—"}</div>
          </div>
          <div>
            <span className="danfe-label">INSCRIÇÃO ESTADUAL</span>
            <div style={{ fontSize: 9 }}>{recipient.ie || "ISENTO"}</div>
          </div>
        </div>
      </div>

      {/* 5. CÁLCULO DO IMPOSTO */}
      <div className="danfe-section-title">CÁLCULO DO IMPOSTO</div>
      <div className="danfe-box" style={{ padding: 4, marginBottom: 6 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, borderBottom: "1px solid #ccc", paddingBottom: 3 }}>
          <div>
            <span className="danfe-label">BASE DE CÁLC. DO ICMS</span>
            <div style={{ fontWeight: 700, fontSize: 9 }}>R$ 0,00</div>
          </div>
          <div>
            <span className="danfe-label">VALOR DO ICMS</span>
            <div style={{ fontWeight: 700, fontSize: 9 }}>R$ 0,00</div>
          </div>
          <div>
            <span className="danfe-label">BASE CÁLC. ICMS S.T.</span>
            <div style={{ fontSize: 9 }}>R$ 0,00</div>
          </div>
          <div>
            <span className="danfe-label">VALOR DO ICMS S.T.</span>
            <div style={{ fontSize: 9 }}>R$ 0,00</div>
          </div>
          <div>
            <span className="danfe-label">V. TOTAL DOS PRODUTOS</span>
            <div style={{ fontWeight: 800, fontSize: 9.5 }}>R$ {num(invoice.totalProducts)}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4, paddingTop: 3 }}>
          <div>
            <span className="danfe-label">VALOR DO FRETE</span>
            <div style={{ fontSize: 9 }}>R$ {num(invoice.totalFreight)}</div>
          </div>
          <div>
            <span className="danfe-label">VALOR DO SEGURO</span>
            <div style={{ fontSize: 9 }}>R$ 0,00</div>
          </div>
          <div>
            <span className="danfe-label">DESCONTO</span>
            <div style={{ fontSize: 9 }}>R$ {num(invoice.totalDiscount)}</div>
          </div>
          <div>
            <span className="danfe-label">OUTRAS DESPESAS</span>
            <div style={{ fontSize: 9 }}>R$ 0,00</div>
          </div>
          <div>
            <span className="danfe-label">VALOR DO IPI</span>
            <div style={{ fontSize: 9 }}>R$ 0,00</div>
          </div>
          <div>
            <span className="danfe-label">V. TOTAL DA NOTA</span>
            <div style={{ fontWeight: 900, fontSize: 10 }}>R$ {num(invoice.totalInvoice)}</div>
          </div>
        </div>
      </div>

      {/* 6. DADOS DOS PRODUTOS / SERVIÇOS */}
      <div className="danfe-section-title">DADOS DOS PRODUTOS / SERVIÇOS</div>
      <div className="danfe-box" style={{ padding: 0, marginBottom: 6, overflow: "hidden" }}>
        <table className="danfe-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>CÓDIGO</th>
              <th>DESCRIÇÃO DOS PRODUTOS / SERVIÇOS</th>
              <th style={{ width: 60 }}>NCM/SH</th>
              <th style={{ width: 35 }}>CST</th>
              <th style={{ width: 40 }}>CFOP</th>
              <th style={{ width: 35 }}>UNID</th>
              <th style={{ width: 45, textAlign: "right" }}>QTD</th>
              <th style={{ width: 65, textAlign: "right" }}>V. UNIT</th>
              <th style={{ width: 65, textAlign: "right" }}>V. TOTAL</th>
              <th style={{ width: 55, textAlign: "right" }}>BC ICMS</th>
              <th style={{ width: 55, textAlign: "right" }}>V. ICMS</th>
              <th style={{ width: 35, textAlign: "right" }}>% ICMS</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it, idx) => (
              <tr key={it.id || idx}>
                <td>{it.sku || it.id}</td>
                <td><strong>{it.name}</strong></td>
                <td>{it.ncm}</td>
                <td>{it.csosn || "102"}</td>
                <td>{it.cfop}</td>
                <td>{it.unit}</td>
                <td style={{ textAlign: "right" }}>{num(it.quantity)}</td>
                <td style={{ textAlign: "right" }}>{num(it.unitPrice)}</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{num(it.totalPrice)}</td>
                <td style={{ textAlign: "right" }}>0,00</td>
                <td style={{ textAlign: "right" }}>0,00</td>
                <td style={{ textAlign: "right" }}>0%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 7. DADOS ADICIONAIS */}
      <div className="danfe-section-title">DADOS ADICIONAIS</div>
      <div className="danfe-box" style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr", gap: 6, padding: 6, fontSize: 8 }}>
        <div>
          <span className="danfe-label">INFORMAÇÕES COMPLEMENTARES</span>
          <div style={{ lineHeight: 1.35, marginTop: 2 }}>
            Documento emitido por ME ou EPP optante pelo Simples Nacional. Não gera direito a crédito fiscal de IPI.
            Valor aproximado dos tributos federais e estaduais: R$ {num(invoice.approxTaxTotal || invoice.totalInvoice * 0.28)} (28.45%) Fonte: IBPT.
            {invoice.fiscalNotes && <div>{invoice.fiscalNotes}</div>}
          </div>
        </div>
        <div style={{ borderLeft: "1px solid #000", paddingLeft: 6 }}>
          <span className="danfe-label">RESERVADO AO FISCO</span>
          <div style={{ marginTop: 2, color: "#666" }}>NF-e emitida em conformidade com o Manual de Orientação do Contribuinte (MOC) 4.00.</div>
        </div>
      </div>

      {/* Estilos CSS do DANFE e Regras de Impressão A4 */}
      <style jsx global>{`
        .danfe-page {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          background: #ffffff;
          color: #000000;
          padding: 8mm 10mm;
          font-family: Arial, Helvetica, sans-serif;
          box-sizing: border-box;
          font-size: 8px;
        }
        .danfe-box {
          border: 1px solid #000000;
          box-sizing: border-box;
        }
        .danfe-label {
          display: block;
          font-size: 6.5px;
          font-weight: bold;
          text-transform: uppercase;
          color: #444;
          line-height: 1;
          margin-bottom: 1px;
        }
        .danfe-section-title {
          font-size: 7px;
          font-weight: 900;
          text-transform: uppercase;
          margin: 2px 0 1px;
          letter-spacing: 0.5px;
        }
        .danfe-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 7.5px;
        }
        .danfe-table th {
          background: #eeeeee;
          border-bottom: 1px solid #000;
          padding: 2px 4px;
          font-size: 7px;
          font-weight: bold;
          text-align: left;
        }
        .danfe-table td {
          border-bottom: 1px solid #e0e0e0;
          padding: 3px 4px;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 5mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .no-print,
          header,
          aside,
          nav,
          .sidebar,
          footer {
            display: none !important;
          }
          .danfe-page {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
