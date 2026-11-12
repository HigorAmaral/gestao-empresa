import { brl, fmtDate, STATUS_LABEL } from "./format";

/** Limpa o telefone e adiciona o DDI 55 (Brasil) se necessário. */
export function cleanPhoneBr(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  return `55${digits}`;
}

export function buildWhatsAppUrl(phone: string | null | undefined, message: string): string {
  const num = cleanPhoneBr(phone);
  const encoded = encodeURIComponent(message);
  return num ? `https://wa.me/${num}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export function saleWhatsAppMessage(sale: {
  id: number;
  status: string;
  date: Date | string;
  total: number;
  paymentMethod?: string | null;
  installments?: number;
  clientName?: string | null;
  items?: { name: string; quantity: number; total: number }[];
  publicUrl?: string | null;
  pixKey?: string | null;
}) {
  const greeting = sale.clientName ? `Olá, *${sale.clientName}*!` : "Olá!";
  const tipo = sale.status === "ORCAMENTO" ? "Orçamento" : "Pedido de Venda";
  const itensTxt =
    sale.items && sale.items.length > 0
      ? "\n\n*Itens:*\n" + sale.items.map((i) => `• ${i.quantity}x ${i.name} — ${brl(i.total)}`).join("\n")
      : "";
  const parc = sale.installments && sale.installments > 1 ? ` (${sale.installments}x)` : "";
  const pag = sale.paymentMethod ? `\n*Pagamento:* ${sale.paymentMethod}${parc}` : "";
  const link = sale.publicUrl ? `\n\n📄 *Acesse seu comprovante e detalhes online:*\n${sale.publicUrl}` : "";
  const pix = sale.pixKey ? `\n\n🔑 *Chave Pix para pagamento:* ${sale.pixKey}` : "";

  return (
    `${greeting}\n` +
    `Segue o resumo do seu *${tipo} #${sale.id}* (${fmtDate(sale.date)}):` +
    itensTxt +
    `\n\n*Total:* ${brl(sale.total)}` +
    pag +
    `\n*Status:* ${STATUS_LABEL[sale.status] ?? sale.status}` +
    link +
    pix +
    `\n\nQualquer dúvida, estamos à disposição!`
  );
}

export function osWhatsAppMessage(os: {
  id: number;
  equipment: string;
  status: string;
  total: number;
  diagnosis?: string | null;
  clientName?: string | null;
  publicUrl?: string | null;
  pixKey?: string | null;
}) {
  const greeting = os.clientName ? `Olá, *${os.clientName}*!` : "Olá!";
  const statusLbl = STATUS_LABEL[os.status] ?? os.status;
  const diag = os.diagnosis ? `\n*Diagnóstico/Serviço:* ${os.diagnosis}` : "";
  const link = os.publicUrl ? `\n\n📄 *Acompanhe o laudo técnico completo online:*\n${os.publicUrl}` : "";
  const pix = os.pixKey ? `\n\n🔑 *Chave Pix para pagamento:* ${os.pixKey}` : "";

  return (
    `${greeting}\n` +
    `Atualização da sua *Ordem de Serviço #${os.id}*:\n\n` +
    `*Equipamento:* ${os.equipment}\n` +
    `*Status:* ${statusLbl}` +
    diag +
    `\n*Valor Total:* ${brl(os.total)}` +
    link +
    pix +
    `\n\nQualquer dúvida, estamos à disposição!`
  );
}

export function financialWhatsAppMessage(entry: {
  description: string;
  amount: number;
  dueDate: Date | string;
  clientName?: string | null;
  pixKey?: string | null;
}) {
  const greeting = entry.clientName ? `Olá, *${entry.clientName}*!` : "Olá!";
  const pix = entry.pixKey ? `\n🔑 *Chave Pix:* ${entry.pixKey}` : "";
  return (
    `${greeting}\n` +
    `Lembrete referente ao título *${entry.description}*:\n` +
    `*Vencimento:* ${fmtDate(entry.dueDate)}\n` +
    `*Valor:* ${brl(entry.amount)}` +
    pix +
    `\n\nCaso já tenha efetuado o pagamento, por favor desconsidere esta mensagem.`
  );
}
