import { SignJWT, jwtVerify } from "jose";
import { normalizeRole, parsePermissions, type ModuleKey, type Role } from "./permissions";

export type { Role };

export const SESSION_COOKIE = "session";
export const SESSION_HOURS = 8;

export type Session = {
  userId: number;
  name: string;
  email: string;
  role: Role;
  permissions: ModuleKey[];
};

function secretKey() {
  return new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");
}

export async function signToken(session: Session) {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey());
}

export async function verifyToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const role: Role = normalizeRole(typeof payload.role === "string" ? payload.role : undefined);
    const rawPerms = Array.isArray(payload.permissions)
      ? payload.permissions.join(",")
      : typeof payload.permissions === "string"
        ? payload.permissions
        : undefined;
    return {
      userId: Number(payload.userId),
      name: String(payload.name),
      email: String(payload.email),
      role,
      permissions: parsePermissions(rawPerms, role),
    };
  } catch {
    return null;
  }
}
