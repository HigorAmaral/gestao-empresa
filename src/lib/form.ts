export type FormState = { error?: string; success?: string } | undefined;

export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export function reqStr(fd: FormData, key: string, label: string): string {
  const v = str(fd, key);
  if (!v) throw new ValidationError(`O campo "${label}" é obrigatório.`);
  return v;
}

export function num(fd: FormData, key: string, def = 0): number {
  const raw = str(fd, key);
  if (raw === null) return def;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : def;
}

export function intOrNull(fd: FormData, key: string): number | null {
  const raw = str(fd, key);
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function dateVal(fd: FormData, key: string): Date | null {
  const v = str(fd, key);
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return new Date(v + "T00:00:00.000Z");
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

export class ValidationError extends Error {}

/** Converte erros conhecidos em mensagens amigáveis. Relança erros de redirect do Next. */
export function toFormError(e: unknown): FormState {
  if (e instanceof ValidationError) return { error: e.message };
  const err = e as { code?: string; digest?: string; message?: string };
  if (typeof err?.digest === "string" && err.digest.startsWith("NEXT_")) throw e;
  if (err?.code === "P2002") return { error: "Já existe um registro com este valor único (ex.: e-mail ou código)." };
  if (err?.code === "P2003") return { error: "Este registro está vinculado a outros dados e não pode ser alterado/excluído." };
  console.error(e);
  return { error: "Ocorreu um erro inesperado. Tente novamente." };
}

export function pageParams(sp: Record<string, string | string[] | undefined>, pageSize = 20) {
  const page = Math.max(1, parseInt(String(sp.page ?? "1"), 10) || 1);
  return { page, skip: (page - 1) * pageSize, take: pageSize, pageSize };
}

export function spStr(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  return typeof v === "string" ? v : "";
}
