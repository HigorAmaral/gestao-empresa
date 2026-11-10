import { NextResponse, type NextRequest } from "next/server";
import { canAccessPath } from "@/lib/permissions";
import { SESSION_COOKIE, verifyToken } from "@/lib/token";

const PUBLIC_PATHS = [
  "/login",
  "/manifest.webmanifest",
  "/sw.js",
  "/api/pwa-icon",
  "/icon",
  "/apple-icon",
];

/** Redireciona usuários não autenticados para /login e valida permissões de módulo por rota. */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (pathname === "/login") {
      const token = request.cookies.get(SESSION_COOKIE)?.value;
      const session = token ? await verifyToken(token) : null;
      if (session) return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!canAccessPath(session, pathname)) {
    const url = new URL("/", request.url);
    url.searchParams.set("erro", "Você não tem permissão para acessar este módulo.");
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
