"use client";

import { useActionState, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { login } from "./actions";

export function LoginForm({
  brandName,
  companyName,
  logoUrl,
}: {
  brandName: string;
  companyName: string;
  logoUrl?: string | null;
}) {
  const [state, action, pending] = useActionState(login, undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const fillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="login-page">
      {/* Orbes luminosos flutuantes ao fundo */}
      <div className="login-orb one" />
      <div className="login-orb two" />

      <div className="login-shell">
        {/* Coluna Esquerda: Showcase Animado do ERP */}
        <div className="login-showcase">
          <div>
            <div className="login-pill">
              <span className="live-dot" />
              {brandName} • ERP Cloud em Tempo Real
            </div>
            <h2>Controle total da sua empresa em um só lugar.</h2>
            <p className="lead">
              Vendas, Ordens de Serviço, Estoque, Compras, Financeiro, DRE e Auditoria integrados com alta velocidade.
            </p>

            {/* Card Flutuante com Gráfico Animado */}
            <div className="login-preview-card">
              <div className="login-preview-header">
                <div>
                  <div style={{ fontSize: 11, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: ".06em" }}>
                    Performance Mensal
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
                    +28,4% em crescimento
                  </div>
                </div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "#ffffff",
                    color: "#09090b",
                    fontSize: 11.5,
                    fontWeight: 700,
                  }}
                >
                  <TrendingUp size={13} /> Ao vivo
                </span>
              </div>

              <div className="login-mini-bars">
                {[38, 52, 46, 68, 62, 84, 78, 98].map((h, i) => (
                  <div
                    key={i}
                    className="login-mini-bar"
                    style={{
                      height: `${h}%`,
                      animationDelay: `${0.35 + i * 0.07}s`,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Destaques */}
            <div className="login-features">
              <div className="login-feature-item">
                <BarChart3 size={16} />
                <span>DRE & Fluxo de Caixa</span>
              </div>
              <div className="login-feature-item">
                <Layers size={16} />
                <span>Estoque & PDV Ágil</span>
              </div>
              <div className="login-feature-item">
                <Zap size={16} />
                <span>Ordens de Serviço</span>
              </div>
              <div className="login-feature-item">
                <ShieldCheck size={16} />
                <span>Auditoria & Níveis</span>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 12, color: "#71717a", marginTop: 28 }}>
            © {new Date().getFullYear()} {companyName} • Arquitetura Monocromática de Alta Precisão
          </div>
        </div>

        {/* Coluna Direita: Formulário de Login Interativo */}
        <form className="login-card" action={action}>
          <div className="brand">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={brandName}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: "#ffffff",
                  objectFit: "contain",
                  padding: 3,
                  border: "1px solid #e4e4e7",
                }}
              />
            ) : (
              <div className="logo">
                <Building2 size={23} />
              </div>
            )}
            <div>
              <h1 style={{ fontSize: 23, color: "#09090b" }}>{brandName}</h1>
              <div style={{ fontSize: 12.5, color: "#71717a" }}>Acesse sua conta corporativa</div>
            </div>
          </div>

          {state?.error && (
            <div className="alert error login-error-shake" style={{ marginBottom: 16 }}>
              {state.error}
            </div>
          )}

          <div className="field">
            <label htmlFor="email" style={{ color: "#18181b" }}>
              E-mail corporativo
            </label>
            <div className="login-input-wrap">
              <Mail size={16} className="input-icon" />
              <input
                id="email"
                name="email"
                type="email"
                placeholder="voce@empresa.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="password" style={{ color: "#18181b" }}>
              Senha de acesso
            </label>
            <div className="login-input-wrap">
              <Lock size={16} className="input-icon" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="login-eye-btn"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button className="login-submit-btn" disabled={pending}>
            {pending ? (
              <>
                <Loader2 size={17} className="spin-icon" /> Autenticando...
              </>
            ) : (
              <>
                Entrar no Sistema <ArrowRight size={16} className="arrow-icon" />
              </>
            )}
          </button>

          <div className="login-demo-box">
            <div className="login-demo-title">
              <span>
                <Sparkles size={12} className="icon-inline" /> Acesso rápido de demonstração
              </span>
              <span style={{ fontWeight: 500, textTransform: "none" }}>Clique para preencher</span>
            </div>
            <div className="login-demo-btns">
              <button
                type="button"
                className="login-demo-btn"
                onClick={() => fillDemo("admin@empresa.com", "admin123")}
              >
                <strong>Administrador</strong>
                <span>admin@empresa.com</span>
              </button>
              <button
                type="button"
                className="login-demo-btn"
                onClick={() => fillDemo("func@empresa.com", "func123")}
              >
                <strong>Funcionário</strong>
                <span>func@empresa.com</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
