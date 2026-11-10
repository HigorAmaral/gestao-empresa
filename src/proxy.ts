import { NextResponse, type NextRequest } from "next/server";
import { canAccessPath } from "@/lib/permissions";
import { SESSION_COOKIE, verifyToken } from "@/lib/token";

/** Redireciona usuários não autenticados para /login e valida permissões de módulo por rota. */
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login";

  if (!session && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (session && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (session && !canAccessPath(session, pathname)) {
    const url = new URL("/", request.url);
    url.searchParams.set("erro", "Você não tem permissão para acessar este módulo.");
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
