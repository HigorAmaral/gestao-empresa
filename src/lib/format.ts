export function brl(value: number | null | undefined) {
  return (value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function num(value: number | null | undefined, digits = 2) {
  return (value ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: digits });
}

/** Datas "de calendário" (vencimento, data da venda) são guardadas à meia-noite UTC. */
export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/** Carimbos de tempo reais (criação, movimentação) mostrados no fuso de Brasília. */
export function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** Valor para <input type="date"> a partir de uma data guardada em UTC. */
export function toInputDate(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

/** Data de hoje (fuso de Brasília) no formato YYYY-MM-DD. */
export function todayInput() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Meia-noite UTC de hoje (data de calendário). */
export function todayUTC() {
  return new Date(todayInput() + "T00:00:00.000Z");
}

export const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${MONTHS[Number(m) - 1]}/${y.slice(2)}`;
}

export const STATUS_LABEL: Record<string, string> = {
  ORCAMENTO: "Orçamento",
  CONFIRMADA: "Confirmada",
  CANCELADA: "Cancelada",
  PENDENTE: "Pendente",
  RECEBIDA: "Recebida",
  PAGO: "Pago",
  CANCELADO: "Cancelado",
  RECEITA: "Receita",
  DESPESA: "Despesa",
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  AJUSTE: "Ajuste",
  ADMIN: "Administrador",
  FUNCIONARIO: "Funcionário",
  VENCIDO: "Vencido",
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  AGUARDANDO_PECA: "Aguardando peça",
  CONCLUIDA: "Concluída",
  BAIXA: "Baixa",
  NORMAL: "Normal",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

export const PAYMENT_METHODS = [
  "Dinheiro",
  "PIX",
  "Cartão de Débito",
  "Cartão de Crédito",
  "Boleto",
  "Transferência",
  "A prazo",
];

/** Formas de pagamento consideradas recebidas no ato. */
export const INSTANT_PAYMENTS = ["Dinheiro", "PIX", "Cartão de Débito"];

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];
