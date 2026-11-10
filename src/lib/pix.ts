/**
 * Gerador oficial de BR Code PIX Estático (Padrão EMV® QRCPS-MPM do Banco Central do Brasil)
 * com cálculo de CRC16-CCITT (0xFFFF / polinômio 0x1021).
 */

function stripAccents(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim();
}

function emvField(id: string, value: string): string {
  const len = String(value.length).padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16Ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function normalizePixKey(rawKey: string): string {
  const trimmed = rawKey.trim();
  if (trimmed.includes("@")) return trimmed.toLowerCase();
  // Chave aleatória EVP (UUID)
  if (/^[0-9a-fA-F-]{32,36}$/.test(trimmed)) return trimmed;
  // CPF ou CNPJ (apenas dígitos)
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 11 || digits.length === 14) return digits;
  return trimmed;
}

export function generatePixPayload({
  pixKey,
  merchantName,
  merchantCity,
  amount,
  txid = "***",
}: {
  pixKey: string;
  merchantName: string;
  merchantCity?: string | null;
  amount?: number;
  txid?: string;
}): string {
  const key = normalizePixKey(pixKey);
  const name = (stripAccents(merchantName) || "EMPRESA").slice(0, 25).toUpperCase();
  const city = (stripAccents(merchantCity || "SAO PAULO") || "SAO PAULO").slice(0, 15).toUpperCase();
  const cleanTxId = (txid.replace(/[^a-zA-Z0-9]/g, "") || "***").slice(0, 25);

  const gui = emvField("00", "br.gov.bcb.pix");
  const keyField = emvField("01", key);
  const merchantAccountInfo = emvField("26", `${gui}${keyField}`);

  const fields = [
    emvField("00", "01"), // Payload Format Indicator
    merchantAccountInfo,
    emvField("52", "0000"), // Merchant Category Code
    emvField("53", "986"), // Moeda (986 = BRL)
    ...(amount && amount > 0 ? [emvField("54", amount.toFixed(2))] : []),
    emvField("58", "BR"), // Country Code
    emvField("59", name), // Merchant Name
    emvField("60", city), // Merchant City
    emvField("62", emvField("05", cleanTxId)), // Additional Data Field (TxID)
  ];

  const partial = fields.join("") + "6304";
  const crc = crc16Ccitt(partial);
  return partial + crc;
}
