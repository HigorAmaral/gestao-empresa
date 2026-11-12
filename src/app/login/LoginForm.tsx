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
  Layers,
  Loader2,
  Lock,
  Mail,
  Phone,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
  X,
} from "lucide-react";
import { login } from "./actions";

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

  // Recupera e-mail salvo se habilitado
  useEffect(() => {
    try {
      const saved = localStorage.getItem("gestaopro_saved_email");
      if (saved) {
        setEmail(saved);
      }
    } catch {}
  }, []);

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (rememberMe) {
      try {
        localStorage.setItem("gestaopro_saved_email", val);
      } catch {}
    }
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
    if (rememberMe) {
      try {
        localStorage.setItem("gestaopro_saved_email", demoEmail);
      } catch {}
    }
  };

  return (
    <div className="corp-login-wrapper">
      {/* Barra sutil de status corporativo no topo */}
      <header className="corp-login-topbar">
        <div className="corp-login-topbar-inner">
          <div className="corp-status-indicator">
            <span className="corp-status-dot" />
            <span>Ambiente Corporativo Conectado</span>
            <span className="corp-status-badge">SSL 256-bit</span>
          </div>
          <div className="corp-topbar-info">
            {companyDocument && <span>CNPJ: {companyDocument}</span>}
            <button
              type="button"
              className="corp-help-trigger"
              onClick={() => setShowHelpModal(true)}
            >
              <HelpCircle size={14} /> Suporte de TI
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Central: Card Dividido Enterprise */}
      <main className="corp-login-main">
        <div className="corp-login-card">
          {/* Coluna Esquerda: Apresentação Institucional e Governança */}
          <aside className="corp-login-hero">
            <div className="corp-hero-content">
              {/* Logo e Nome da Empresa */}
              <div className="corp-hero-brand">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={brandName}
                    className="corp-hero-logo"
                  />
                ) : (
                  <div className="corp-hero-logo-placeholder">
                    <Building2 size={28} />
                  </div>
                )}
                <div>
                  <h2 className="corp-hero-title">{brandName}</h2>
                  <p className="corp-hero-subtitle">{companyName}</p>
                </div>
              </div>

              {/* Título de Boas-Vindas */}
              <div className="corp-hero-statement">
                <h1>Sistema Integrado de Gestão Empresarial</h1>
                <p>
                  Plataforma unificada para controladoria financeira, inteligência comercial,
                  emissão de NF-e, logística de estoque, ordens de serviço e gestão de pessoas.
                </p>
              </div>

              {/* Pilares Estratégicos Corporativos */}
              <div className="corp-hero-features">
                <div className="corp-feature-box">
                  <div className="corp-feature-icon">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <strong>Governança & Rastreabilidade</strong>
                    <span>Auditoria completa com isolamento de dados LGPD.</span>
                  </div>
                </div>

                <div className="corp-feature-box">
                  <div className="corp-feature-icon">
                    <TrendingUp size={18} />
                  </div>
                  <div>
                    <strong>Controladoria em Tempo Real</strong>
                    <span>DRE gerencial, conciliação OFX e faturamento Pix.</span>
                  </div>
                </div>

                <div className="corp-feature-box">
                  <div className="corp-feature-icon">
                    <Layers size={18} />
                  </div>
                  <div>
                    <strong>Operações & WMS de Estoque</strong>
                    <span>Chão de fábrica, rastreio por lote e ordens técnicas.</span>
                  </div>
                </div>
              </div>

              {/* Selos de Certificação & Segurança */}
              <div className="corp-hero-trust">
                <div className="corp-trust-item">
                  <Shield size={14} /> Criptografia Ponta a Ponta
                </div>
                <div className="corp-trust-item">
                  <Server size={14} /> Alta Disponibilidade 99.9%
                </div>
                <div className="corp-trust-item">
                  <CheckCircle2 size={14} /> Conforme LGPD
                </div>
              </div>
            </div>

            <footer className="corp-hero-footer">
              © {new Date().getFullYear()} {companyName}. Uso restrito e confidencial.
            </footer>
          </aside>

          {/* Coluna Direita: Formulário de Autenticação */}
          <section className="corp-login-form-area">
            <div className="corp-form-header">
              <div className="corp-form-kicker">
                <UserCheck size={14} /> Portal do Colaborador & Gestão
              </div>
              <h2>Acesso ao Sistema</h2>
              <p>Insira suas credenciais corporativas para iniciar a sessão.</p>
            </div>

            {state?.error && (
              <div className="corp-alert-error" role="alert">
                <div className="corp-alert-icon">!</div>
                <div>
                  <strong>Falha na autenticação</strong>
                  <p>{state.error}</p>
                </div>
              </div>
            )}

            <form action={action} className="corp-form-element">
              {/* Campo E-mail */}
              <div className="corp-field">
                <label htmlFor="corp-email">
                  E-mail Corporativo <span className="corp-req">*</span>
                </label>
                <div className="corp-input-wrapper">
                  <Mail size={17} className="corp-input-icon" />
                  <input
                    id="corp-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="colaborador@empresa.com.br"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Campo Senha */}
              <div className="corp-field">
                <div className="corp-label-row">
                  <label htmlFor="corp-password">
                    Senha de Acesso <span className="corp-req">*</span>
                  </label>
                  <button
                    type="button"
                    className="corp-forgot-link"
                    onClick={() => setShowHelpModal(true)}
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="corp-input-wrapper">
                  <Lock size={17} className="corp-input-icon" />
                  <input
                    id="corp-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="corp-toggle-password"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Opção Lembrar Usuário */}
              <div className="corp-options-row">
                <label className="corp-checkbox-label">
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
                className="corp-submit-btn"
                disabled={pending}
              >
                {pending ? (
                  <>
                    <Loader2 size={18} className="corp-spin" /> Autenticando Credenciais...
                  </>
                ) : (
                  <>
                    Acessar Painel Corporativo <ArrowRight size={17} />
                  </>
                )}
              </button>

              {/* Box de Acesso Rápido / Demonstração */}
              <div className="corp-demo-card">
                <div className="corp-demo-header">
                  <span className="corp-demo-pill">
                    <Sparkles size={12} /> Ambiente de Demonstração
                  </span>
                  <span className="corp-demo-tip">Preenchimento automático</span>
                </div>

                <div className="corp-demo-grid">
                  <button
                    type="button"
                    className="corp-demo-chip admin"
                    onClick={() => fillDemo("admin@empresa.com", "admin123")}
                  >
                    <div className="corp-demo-chip-icon">
                      <KeyRound size={14} />
                    </div>
                    <div className="corp-demo-chip-text">
                      <strong>Administrador</strong>
                      <span>admin@empresa.com</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="corp-demo-chip staff"
                    onClick={() => fillDemo("func@empresa.com", "func123")}
                  >
                    <div className="corp-demo-chip-icon">
                      <UserCheck size={14} />
                    </div>
                    <div className="corp-demo-chip-text">
                      <strong>Colaborador</strong>
                      <span>func@empresa.com</span>
                    </div>
                  </button>
                </div>
              </div>
            </form>

            <div className="corp-form-footer">
              <p>
                <strong>Aviso de Segurança:</strong> O acesso a este sistema é monitorado e
                restrito a colaboradores autorizados da empresa.
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Modal / Dialog de Ajuda e Suporte de TI */}
      {showHelpModal && (
        <div className="corp-modal-overlay" onClick={() => setShowHelpModal(false)}>
          <div
            className="corp-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="corp-modal-header">
              <div className="corp-modal-title">
                <HelpCircle size={20} color="#2563eb" />
                <h3>Suporte Corporativo & Redefinição de Senha</h3>
              </div>
              <button
                type="button"
                className="corp-modal-close"
                onClick={() => setShowHelpModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="corp-modal-body">
              <p>
                Por motivos de conformidade e segurança corporativa, a redefinição de senhas de
                acesso deve ser solicitada diretamente ao administrador do sistema ou ao time
                interno de Tecnologia da Informação.
              </p>

              <div className="corp-contact-list">
                {companyEmail && (
                  <div className="corp-contact-item">
                    <Mail size={16} />
                    <div>
                      <small>E-mail Corporativo</small>
                      <strong>{companyEmail}</strong>
                    </div>
                  </div>
                )}
                {companyPhone && (
                  <div className="corp-contact-item">
                    <Phone size={16} />
                    <div>
                      <small>Telefone / Ramal</small>
                      <strong>{companyPhone}</strong>
                    </div>
                  </div>
                )}
                {companyDocument && (
                  <div className="corp-contact-item">
                    <Building2 size={16} />
                    <div>
                      <small>Empresa</small>
                      <strong>{companyName}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="corp-modal-footer">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setShowHelpModal(false)}
              >
                Entendido, Voltar ao Login
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
