export const UF_IBGE_CODES: Record<string, string> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27", SE: "28", BA: "29",
  MG: "31", ES: "32", RJ: "33", SP: "35",
  PR: "41", SC: "42", RS: "43",
  MS: "50", MT: "51", GO: "52", DF: "53",
};

/**
 * Calcula o Dígito Verificador (Módulo 11) segundo o padrão da Receita Federal / SEFAZ
 */
export function calculateModulo11(chave43: string): number {
  let soma = 0;
  let peso = 2;

  for (let i = chave43.length - 1; i >= 0; i--) {
    const num = parseInt(chave43.charAt(i), 10);
    soma += num * peso;
    peso++;
    if (peso > 9) peso = 2;
  }

  const resto = soma % 11;
  if (resto === 0 || resto === 1) {
    return 0;
  }
  return 11 - resto;
}

/**
 * Gera a Chave de Acesso oficial de 44 dígitos da NF-e (Modelo 55)
 */
export function generateNfeAccessKey({
  uf,
  emissionDate,
  cnpj,
  model = "55",
  series,
  number,
  emissionType = "1", // 1 = Normal
  codeNumber,
}: {
  uf: string;
  emissionDate: Date;
  cnpj: string;
  model?: string;
  series: number;
  number: number;
  emissionType?: string;
  codeNumber?: number;
}): { accessKey: string; cNF: string; cDV: number } {
  // 1. Código da UF (2 dígitos)
  const ufClean = uf.toUpperCase().trim();
  const cUF = UF_IBGE_CODES[ufClean] || "35"; // Padrão SP se não reconhecido

  // 2. Ano e Mês de Emissão (AAMM - 4 dígitos)
  const yy = String(emissionDate.getFullYear()).slice(-2);
  const mm = String(emissionDate.getMonth() + 1).padStart(2, "0");
  const aamm = `${yy}${mm}`;

  // 3. CNPJ do Emitente (14 dígitos)
  const cleanCnpj = cnpj.replace(/\D/g, "").padStart(14, "0").slice(0, 14);

  // 4. Modelo (2 dígitos - 55 para NF-e)
  const mod = model.padStart(2, "0");

  // 5. Série (3 dígitos)
  const serie = String(series).padStart(3, "0").slice(0, 3);

  // 6. Número da NF-e (9 dígitos)
  const nNF = String(number).padStart(9, "0").slice(0, 9);

  // 7. Tipo de Emissão (1 dígito - 1=Normal)
  const tpEmis = emissionType.slice(0, 1);

  // 8. Código Numérico aleatório (8 dígitos)
  const cNF = codeNumber
    ? String(codeNumber).padStart(8, "0").slice(0, 8)
    : String(Math.floor(10000000 + Math.random() * 90000000));

  // Concatena os 43 dígitos
  const chave43 = `${cUF}${aamm}${cleanCnpj}${mod}${serie}${nNF}${tpEmis}${cNF}`;

  // 9. Dígito Verificador (1 dígito)
  const cDV = calculateModulo11(chave43);

  const accessKey = `${chave43}${cDV}`;

  return { accessKey, cNF, cDV };
}

/**
 * Formata a Chave de Acesso em grupos de 4 dígitos para fácil leitura no DANFE
 * Ex: 3526 1100 0000 0001 0055 0010 0000 0001 1123 4567 8901
 */
export function formatAccessKey(key: string): string {
  const clean = key.replace(/\D/g, "");
  return clean.replace(/(\d{4})/g, "$1 ").trim();
}
