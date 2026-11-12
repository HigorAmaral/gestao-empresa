"use client";

import { useActionState, useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import { login } from "./actions";
import { MascotWall, type MascotState } from "./MascotWall";
import { OpenTicketModal } from "./OpenTicketModal";

export interface LoginFormProps {
  brandName: string;
  companyName: string;
  logoUrl?: string | null;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  primaryColor?: string | null;
}

export function LoginForm({
  brandName,
  companyName,
  logoUrl,
  document: companyDocument,
  phone: companyPhone,
  email: companyEmail,
}: LoginFormProps) {
  const [state, action, pending] = useActionState(login, undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [focusField, setFocusField] = useState<"email" | "password" | null>(null);
  const [clearedError, setClearedError] = useState(false);

  // Recupera e-mail salvo se habilitado
  useEffect(() => {
    try {
      const saved = localStorage.getItem("gestaopro_saved_email");
      if (saved) {
        setEmail(saved);
      }
    } catch {}
  }, []);

  // Quando o state.error muda (novo erro do servidor), reativa a reação de susto da mascote
  useEffect(() => {
    if (state?.error) {
      setClearedError(false);
    }
  }, [state?.error]);

  const handleEmailChange = (val: string) => {
    setEmail(val);
    setClearedError(true);
    if (rememberMe) {
      try {
        localStorage.setItem("gestaopro_saved_email", val);
      } catch {}
    }
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    setClearedError(true);
  };

  const handleRememberToggle = (checked: boolean) => {
    setRememberMe(checked);
    if (!checked) {
      try {
        localStorage.removeItem("gestaopro_saved_email");
      } catch {}
    } else if (email) {
      try {
        localStorage.setItem("gestaopro_saved_email", email);
      } catch {}
    }
  };

  const fillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setClearedError(true);
    setFocusField("password");
    if (rememberMe) {
      try {
        localStorage.setItem("gestaopro_saved_email", demoEmail);
      } catch {}
    }
  };

  // Determina o estado de humor e reação física da mascote na parede
  let mascotState: MascotState = "idle";
  if (pending) {
    mascotState = "pending";
  } else if (state?.error && !clearedError) {
    mascotState = "error";
  } else if (focusField === "password") {
    mascotState = showPassword ? "password_visible" : "password_hidden";
  } else if (focusField === "email") {
    mascotState = "email";
  }

  return (
    <div className="bw-login-wrapper">
      {/* Topbar Monocromática com Status */}
      <header className="bw-login-topbar">
        <div className="bw-login-topbar-inner">
          <div className="bw-status-indicator">
            <span className="bw-status-dot" />
            <span>Sistema Operacional Corporativo</span>
            <span className="bw-status-badge">Preto & Branco • Enterprise</span>
          </div>
          <div className="bw-topbar-info">
            {companyDocument && <span>CNPJ: {companyDocument}</span>}
            <button
              type="button"
              className="bw-help-trigger"
              onClick={() => setShowHelpModal(true)}
            >
              <HelpCircle size={14} /> Suporte TI
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal Dividido */}
      <main className="bw-login-main">
        <div className="bw-login-card">
          {/* ====================================================
              COLUNA ESQUERDA: MASCOTE ANIMADA EM CIMA DA PAREDE
              ==================================================== */}
          <aside className="bw-login-hero">
            <div className="bw-hero-top">
              <div className="bw-hero-brand">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={brandName}
                    className="bw-hero-logo"
                  />
                ) : (
                  <div className="bw-hero-logo-placeholder">
                    <Building2 size={24} />
                  </div>
                )}
                <div>
                  <h2 className="bw-hero-title">{brandName}</h2>
                  <p className="bw-hero-subtitle">{companyName}</p>
                </div>
              </div>

              <div className="bw-hero-tag">
                <ShieldCheck size={13} /> Muralha de Segurança & Auditoria
              </div>
            </div>

            {/* A Mascote Interativa sobre o Muro */}
            <div className="bw-hero-mascot-slot">
              <MascotWall state={mascotState} brandName={brandName} />
            </div>

            <footer className="bw-hero-footer">
              <span>© {new Date().getFullYear()} {companyName}</span>
              <span>Acesso restrito e criptografado</span>
            </footer>
          </aside>

          {/* ====================================================
              COLUNA DIREITA: FORMULÁRIO DE LOGIN MONOCROMÁTICO
              ==================================================== */}
          <section className="bw-login-form-area">
            <div className="bw-form-header">
              <div className="bw-form-kicker">
                <UserCheck size={14} /> Autenticação Corporativa
              </div>
              <h2>Acesso ao Sistema</h2>
              <p>Insira suas credenciais corporativas para entrar.</p>
            </div>

            {state?.error && (
              <div className="bw-alert-error" role="alert">
                <div className="bw-alert-icon">!</div>
                <div>
                  <strong>Falha na autenticação</strong>
                  <p>{state.error}</p>
                </div>
              </div>
            )}

            <form action={action} className="bw-form-element">
              {/* Campo E-mail */}
              <div className="bw-field">
                <label htmlFor="bw-email">
                  E-mail Corporativo <span className="bw-req">*</span>
                </label>
                <div className="bw-input-wrapper">
                  <Mail size={16} className="bw-input-icon" />
                  <input
                    id="bw-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="colaborador@empresa.com.br"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    onFocus={() => setFocusField("email")}
                    onBlur={() => setFocusField(null)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Campo Senha */}
              <div className="bw-field">
                <div className="bw-label-row">
                  <label htmlFor="bw-password">
                    Senha de Acesso <span className="bw-req">*</span>
                  </label>
                  <button
                    type="button"
                    className="bw-forgot-link"
                    onClick={() => setShowHelpModal(true)}
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="bw-input-wrapper">
                  <Lock size={16} className="bw-input-icon" />
                  <input
                    id="bw-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    onFocus={() => setFocusField("password")}
                    onBlur={() => setFocusField(null)}
                    required
                  />
                  <button
                    type="button"
                    className="bw-toggle-password"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                    title={showPassword ? "Ocultar senha (mascote cobre os olhos)" : "Mostrar senha (mascote espia)"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Opção Lembrar Usuário */}
              <div className="bw-options-row">
                <label className="bw-checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => handleRememberToggle(e.target.checked)}
                  />
                  <span>Lembrar meu usuário neste dispositivo</span>
                </label>
              </div>

              {/* Botão Entrar */}
              <button
                type="submit"
                className="bw-submit-btn"
                disabled={pending}
              >
                {pending ? (
                  <>
                    <Loader2 size={17} className="bw-spin" /> Autenticando...
                  </>
                ) : (
                  <>
                    Entrar no Sistema <ArrowRight size={16} />
                  </>
                )}
              </button>

              {/* Acesso Rápido de Demonstração */}
              <div className="bw-demo-card">
                <div className="bw-demo-header">
                  <span className="bw-demo-pill">
                    <Sparkles size={11} /> Acesso de Homologação
                  </span>
                  <span className="bw-demo-tip">Clique para preencher</span>
                </div>

                <div className="bw-demo-grid">
                  <button
                    type="button"
                    className="bw-demo-chip"
                    onClick={() => fillDemo("admin@empresa.com", "admin123")}
                  >
                    <div className="bw-demo-chip-icon">
                      <KeyRound size={14} />
                    </div>
                    <div className="bw-demo-chip-text">
                      <strong>Administrador</strong>
                      <span>admin@empresa.com</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="bw-demo-chip"
                    onClick={() => fillDemo("func@empresa.com", "func123")}
                  >
                    <div className="bw-demo-chip-icon">
                      <UserCheck size={14} />
                    </div>
                    <div className="bw-demo-chip-text">
                      <strong>Colaborador</strong>
                      <span>func@empresa.com</span>
                    </div>
                  </button>
                </div>
              </div>
            </form>

            <div className="bw-form-footer">
              <p>
                <strong>Ambiente Monitorado:</strong> Atividades de login são registradas em trilha de auditoria corporativa.
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Modal Interativo de Suporte de TI & Abertura de Chamado */}
      <OpenTicketModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        companyName={companyName}
        companyEmail={companyEmail}
        companyPhone={companyPhone}
        companyDocument={companyDocument}
      />
    </div>
  );
}
