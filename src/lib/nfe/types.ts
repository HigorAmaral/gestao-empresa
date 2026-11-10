export type TaxRegime = "1" | "2" | "3"; // 1=Simples Nacional, 2=Simples Nacional excesso, 3=Regime Normal
export type NfeEnvironment = "HOMOLOGACAO" | "PRODUCAO"; // 2=Homologação (Testes), 1=Produção
export type NfeStatus = "RASCUNHO" | "PROCESSANDO" | "AUTORIZADA" | "CANCELADA" | "REJEITADA";

export type NfeCompanyData = {
  name: string;
  tradeName?: string | null;
  document: string; // CNPJ
  stateRegistration?: string | null; // IE
  taxRegime: string;
  environment: NfeEnvironment;
  series: number;
  nextNumber: number;
  apiProvider?: string | null;
  apiKey?: string | null;
  cscId?: string | null;
  cscToken?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  ibgeCityCode?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
};

export type NfeRecipientData = {
  name: string;
  document: string; // CPF ou CNPJ
  ie?: string | null;
  ieIndicator?: string | null; // 1=Contribuinte, 2=Isento, 9=Não Contribuinte
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  ibgeCode?: string | null;
};

export type NfeItemData = {
  itemNumber: number;
  productId: number;
  sku?: string | null;
  name: string;
  ncm: string;
  cest?: string | null;
  cfop: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  discount?: number;
  origin: string; // 0=Nacional
  csosn?: string | null; // Simples Nacional (101, 102, 500, etc.)
  cstIcms?: string | null; // Regime Normal (00, 20, 40, etc.)
  icmsRate?: number;
  icmsValue?: number;
  pisRate?: number;
  pisValue?: number;
  cofinsRate?: number;
  cofinsValue?: number;
};

export type NfeEmissionResult = {
  success: boolean;
  status: NfeStatus;
  accessKey: string;
  protocol?: string;
  authorizedAt?: Date;
  cStat: string;
  xMotivo: string;
  xmlContent?: string;
  danfeUrl?: string;
  xmlUrl?: string;
  errorMessage?: string;
};
