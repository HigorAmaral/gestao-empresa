import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET ?? "gestao-empresa-dev-secret-change-in-production-32chars";

export function makePublicToken(kind: "venda" | "os", id: number): string {
  return crypto
    .createHmac("sha256", SECRET)
    .update(`${kind}:${id}`)
    .digest("hex")
    .slice(0, 14);
}

export function verifyPublicToken(kind: "venda" | "os", id: number, token?: string | null): boolean {
  if (!token) return false;
  const expected = makePublicToken(kind, id);
  return token === expected;
}
