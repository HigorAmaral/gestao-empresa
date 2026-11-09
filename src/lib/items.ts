import { ValidationError } from "./form";

export type ParsedItem = { productId: number; quantity: number; price: number };

/** Lê e valida o JSON de itens enviado pelo ItemsEditor. */
export function parseItems(fd: FormData, allowEmpty = false): ParsedItem[] {
  let raw: unknown;
  try {
    raw = JSON.parse(String(fd.get("items") ?? "[]"));
  } catch {
    throw new ValidationError("Itens inválidos.");
  }
  if (!Array.isArray(raw)) throw new ValidationError("Itens inválidos.");
  if (raw.length === 0) {
    if (allowEmpty) return [];
    throw new ValidationError("Adicione pelo menos um item.");
  }

  const merged = new Map<number, ParsedItem>();
  for (const r of raw) {
    const productId = Number(r?.productId);
    const quantity = Number(r?.quantity);
    const price = Number(r?.price);
    if (!Number.isInteger(productId) || productId <= 0) throw new ValidationError("Produto inválido.");
    if (!Number.isFinite(quantity) || quantity <= 0) throw new ValidationError("Quantidade deve ser maior que zero.");
    if (!Number.isFinite(price) || price < 0) throw new ValidationError("Preço não pode ser negativo.");
    const prev = merged.get(productId);
    if (prev) prev.quantity += quantity;
    else merged.set(productId, { productId, quantity, price });
  }
  return [...merged.values()];
}

export const round2 = (v: number) => Math.round(v * 100) / 100;
