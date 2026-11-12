import { NextResponse, type NextRequest } from "next/server";
import { canAccessPath } from "@/lib/permissions";
import { SESSION_COOKIE, verifyToken } from "@/lib/token";
import {
  inspectRequest,
  checkRateLimit,
  applySecurityHeaders,
  getSecurityHeaders,
} from "@/lib/security-rules";

const PUBLIC_PATHS = [
  "/login",
  "/p",
  "/api/rep/sync",
  "/api/automations/run",
  "/manifest.webmanifest",
  "/sw.js",
  "/api/pwa-icon",
  "/icon",
  "/apple-icon",
];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";
  const userAgent = request.headers.get("user-agent") || "";

  // 1. Limitação de Taxa Adaptativa (Anti-DDoS / Brute Force Mitigation)
  const isAuthRoute = pathname === "/login";
  const rateLimit = checkRateLimit(
    ip,
    isAuthRoute ? "AUTH" : "GENERAL",
    isAuthRoute ? 20 : 180,
    60
  );

  if (!rateLimit.allowed) {
    const rateLimitResponse = new NextResponse(
      "Limite de requisições excedido. Por segurança, aguarde alguns instantes antes de tentar novamente.",
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.resetInSec),
          "Content-Type": "text/plain; charset=utf-8",
        },
      }
    );
    applySecurityHeaders(rateLimitResponse.headers);
    return rateLimitResponse;
  }

  // 2. Inspeção de Ataques pelo WAF (SQLi, XSS, Path Traversal, Scanners Maliciosos, Probes)
  const inspection = inspectRequest(pathname, search, userAgent);
  if (inspection.blocked) {
    const blockHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>403 - Acesso Bloqueado pelo Firewall (WAF)</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#09090b;color:#f4f4f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;box-sizing:border-box;">
  <div style="background:#18181b;border:1px solid #27272a;border-radius:14px;padding:36px;max-width:500px;text-align:center;box-shadow:0 24px 48px rgba(0,0,0,0.6);">
    <div style="width:58px;height:58px;background:rgba(239,68,68,0.12);border:1px solid #ef4444;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;color:#ef4444;font-size:26px;font-weight:900;">✕</div>
    <h1 style="font-size:21px;font-weight:700;margin:0 0 10px;color:#ffffff;letter-spacing:-0.5px;">Acesso Bloqueado pelo Firewall (WAF)</h1>
    <p style="font-size:13.5px;color:#a1a1aa;line-height:1.6;margin:0 0 22px;">Esta requisição foi interceptada pelo sistema de detecção e defesa contra intrusões por conter assinaturas potencialmente perigosas.</p>
    <div style="background:#09090b;border:1px solid #27272a;border-radius:10px;padding:14px;text-align:left;font-size:12.5px;color:#a1a1aa;font-family:ui-monospace,SFMono-Regular,monospace;margin-bottom:24px;line-height:1.7;">
      <div><strong style="color:#ffffff;">Ameaça:</strong> <span style="color:#f87171;">${inspection.reason || "Padrão suspeito"}</span></div>
      <div><strong style="color:#ffffff;">Classificação:</strong> ${inspection.eventType || "WAF_SIGNATURE"}</div>
      <div><strong style="color:#ffffff;">Severidade:</strong> <span style="color:${inspection.severity === "CRITICAL" ? "#ef4444" : "#f59e0b"};font-weight:bold;">${inspection.severity || "HIGH"}</span></div>
      <div><strong style="color:#ffffff;">Endereço IP:</strong> ${ip}</div>
    </div>
    <a href="/login" style="display:inline-block;background:#ffffff;color:#09090b;font-weight:600;padding:11px 22px;border-radius:8px;text-decoration:none;font-size:13.5px;transition:opacity 0.2s;">Retornar à Navegação Segura</a>
  </div>
</body>
</html>`;

    return new NextResponse(blockHtml, {
      status: 403,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        ...getSecurityHeaders(),
      },
    });
  }

  // 3. Validação de Rotas Públicas
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (pathname === "/login") {
      const token = request.cookies.get(SESSION_COOKIE)?.value;
      const session = token ? await verifyToken(token) : null;
      if (session) {
        const res = NextResponse.redirect(new URL("/", request.url));
        applySecurityHeaders(res.headers);
        return res;
      }
    }
    const res = NextResponse.next();
    applySecurityHeaders(res.headers);
    return res;
  }

  // 4. Validação de Autenticação e Permissão de Módulo
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;

  if (!session) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    applySecurityHeaders(res.headers);
    return res;
  }

  if (!canAccessPath(session, pathname)) {
    const url = new URL("/", request.url);
    url.searchParams.set("erro", "Você não tem permissão para acessar este módulo.");
    const res = NextResponse.redirect(url);
    applySecurityHeaders(res.headers);
    return res;
  }

  const res = NextResponse.next();
  applySecurityHeaders(res.headers);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
