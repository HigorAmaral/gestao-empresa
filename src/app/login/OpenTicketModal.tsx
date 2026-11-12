"use client";

import { useActionState, useState } from "react";
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Headphones,
  LifeBuoy,
  Loader2,
  Mail,
  Phone,
  Send,
  Ticket,
  X,
} from "lucide-react";
import { openPublicTicketAction } from "./ticketActions";

interface OpenTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  companyEmail?: string | null;
  companyPhone?: string | null;
  companyDocument?: string | null;
}

export function OpenTicketModal({
  isOpen,
  onClose,
  companyName,
  companyEmail,
  companyPhone,
  companyDocument,
}: OpenTicketModalProps) {
  const [activeTab, setActiveTab] = useState<"form" | "contacts">("form");
  const [copied, setCopied] = useState(false);
  const [state, action, pending] = useActionState(openPublicTicketAction, undefined);

  if (!isOpen) return null;

  const handleCopyProtocol = (protocol: string) => {
    try {
      navigator.clipboard.writeText(protocol);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="bw-modal-overlay" onClick={onClose}>
      <div
        className="bw-modal-card bw-ticket-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Cabeçalho do Modal */}
        <div className="bw-modal-header">
          <div className="bw-modal-title">
            <Headphones size={20} />
            <div>
              <h3>Suporte de TI & Abertura de Chamados</h3>
              <span className="bw-modal-subtitle">Equipe de Tecnologia e Infraestrutura</span>
            </div>
          </div>
          <button
            type="button"
            className="bw-modal-close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Abas do Modal */}
        <div className="bw-modal-tabs">
          <button
            type="button"
            className={`bw-modal-tab ${activeTab === "form" ? "active" : ""}`}
            onClick={() => setActiveTab("form")}
          >
            <Ticket size={15} /> Abrir Novo Chamado
          </button>
          <button
            type="button"
            className={`bw-modal-tab ${activeTab === "contacts" ? "active" : ""}`}
            onClick={() => setActiveTab("contacts")}
          >
            <Phone size={15} /> Contatos & Ramais
          </button>
        </div>

        {/* Conteúdo da Aba 1: Formulário de Abertura de Chamado */}
        {activeTab === "form" && (
          <div className="bw-modal-body">
            {state?.success && state?.ticketNumber ? (
              // Tela de Sucesso com Protocolo
              <div className="bw-ticket-success">
                <div className="bw-ticket-success-icon">
                  <CheckCircle2 size={42} />
                </div>
                <h4>Chamado Registrado com Sucesso!</h4>
                <p>
                  Sua solicitação foi enviada para a fila de atendimento da equipe de TI.
                  Guarde o número de protocolo abaixo:
                </p>

                <div className="bw-protocol-badge">
                  <span>PROTOCOLO OFICIAL</span>
                  <strong>{state.ticketNumber}</strong>
                  <button
                    type="button"
                    className="bw-protocol-copy-btn"
                    onClick={() => handleCopyProtocol(state.ticketNumber!)}
                  >
                    {copied ? (
                      <>
                        <Check size={14} /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy size={14} /> Copiar
                      </>
                    )}
                  </button>
                </div>

                <div className="bw-ticket-success-footer">
                  <button
                    type="button"
                    className="bw-submit-btn"
                    onClick={onClose}
                  >
                    Concluir & Voltar ao Login
                  </button>
                </div>
              </div>
            ) : (
              // Formulário de Abertura
              <form action={action} className="bw-ticket-form">
                <p className="bw-ticket-intro">
                  Precisa de suporte com senha, erro no sistema, computador ou acesso? Preencha os
                  dados abaixo para abrir um chamado direto para a equipe técnica:
                </p>

                {state?.error && (
                  <div className="bw-alert-error" style={{ marginBottom: 14 }}>
                    <AlertCircle size={16} />
                    <span>{state.error}</span>
                  </div>
                )}

                <div className="bw-form-grid-2">
                  <div className="bw-field">
                    <label htmlFor="requesterName">
                      Seu Nome Completo <span className="bw-req">*</span>
                    </label>
                    <input
                      id="requesterName"
                      name="requesterName"
                      type="text"
                      placeholder="Ex: Carlos Silva"
                      required
                      className="bw-modal-input"
                    />
                  </div>

                  <div className="bw-field">
                    <label htmlFor="department">Departamento</label>
                    <select
                      id="department"
                      name="department"
                      defaultValue="Vendas"
                      className="bw-modal-input"
                    >
                      <option value="Vendas">Vendas / Comercial</option>
                      <option value="Financeiro">Financeiro / Controladoria</option>
                      <option value="RH">Recursos Humanos (RH)</option>
                      <option value="Estoque">Estoque & Logística (WMS)</option>
                      <option value="Producao">Produção & Fábrica (PCP)</option>
                      <option value="Assistencia">Assistência Técnica (OS)</option>
                      <option value="Diretoria">Diretoria / Gestão</option>
                      <option value="Outro">Outro Departamento</option>
                    </select>
                  </div>
                </div>

                <div className="bw-form-grid-2">
                  <div className="bw-field">
                    <label htmlFor="requesterEmail">E-mail para Retorno</label>
                    <input
                      id="requesterEmail"
                      name="requesterEmail"
                      type="email"
                      placeholder="seu.email@empresa.com"
                      className="bw-modal-input"
                    />
                  </div>

                  <div className="bw-field">
                    <label htmlFor="requesterPhone">WhatsApp / Telefone</label>
                    <input
                      id="requesterPhone"
                      name="requesterPhone"
                      type="tel"
                      placeholder="(11) 98765-4321"
                      className="bw-modal-input"
                    />
                  </div>
                </div>

                <div className="bw-form-grid-2">
                  <div className="bw-field">
                    <label htmlFor="category">Categoria do Problema</label>
                    <select
                      id="category"
                      name="category"
                      defaultValue="ACESSO_SENHA"
                      className="bw-modal-input"
                    >
                      <option value="ACESSO_SENHA">🔑 Problema com Senha ou Acesso Bloqueado</option>
                      <option value="SISTEMA_ERRO">⚙️ Erro na Tela ou Dúvida no Sistema ERP</option>
                      <option value="EQUIPAMENTO_HARDWARE">💻 Computador, Notebook ou Impressora</option>
                      <option value="REDE_INTERNET">🌐 Conexão de Rede / Internet / Wi-Fi</option>
                      <option value="INSTALACAO_SOFTWARE">📋 Instalação de Programas / Permissões</option>
                      <option value="OUTRO">❓ Outro Assunto de TI</option>
                    </select>
                  </div>

                  <div className="bw-field">
                    <label htmlFor="priority">Prioridade</label>
                    <select
                      id="priority"
                      name="priority"
                      defaultValue="NORMAL"
                      className="bw-modal-input"
                    >
                      <option value="BAIXA">🟢 Baixa (Dúvidas ou melhorias)</option>
                      <option value="NORMAL">⚪ Normal (Atendimento padrão)</option>
                      <option value="ALTA">🟠 Alta (Impacta minha rotina)</option>
                      <option value="URGENTE">🔴 Urgente (Trabalho totalmente parado)</option>
                    </select>
                  </div>
                </div>

                <div className="bw-field">
                  <label htmlFor="title">
                    Assunto do Chamado <span className="bw-req">*</span>
                  </label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    placeholder="Ex: Não consigo fazer login / Tela travando em Vendas"
                    required
                    className="bw-modal-input"
                  />
                </div>

                <div className="bw-field">
                  <label htmlFor="description">
                    Descrição Detalhada do Problema <span className="bw-req">*</span>
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    placeholder="Descreva o que está acontecendo, mensagens de erro que apareceram ou o que você precisa que seja feito..."
                    required
                    className="bw-modal-input"
                    style={{ resize: "vertical" }}
                  />
                </div>

                <div className="bw-modal-footer-form">
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={onClose}
                    disabled={pending}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bw-submit-btn"
                    style={{ width: "auto", padding: "10px 20px" }}
                    disabled={pending}
                  >
                    {pending ? (
                      <>
                        <Loader2 size={16} className="bw-spin" /> Registrando...
                      </>
                    ) : (
                      <>
                        <Send size={15} /> Abrir Chamado de TI
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Conteúdo da Aba 2: Contatos Diretos da TI */}
        {activeTab === "contacts" && (
          <div className="bw-modal-body">
            <p className="bw-ticket-intro">
              Caso seja uma emergência técnica crítica ou você precise falar diretamente com a
              equipe de suporte interno:
            </p>

            <div className="bw-contact-list">
              {companyEmail && (
                <div className="bw-contact-item">
                  <Mail size={16} />
                  <div>
                    <small>E-mail do Suporte / TI</small>
                    <strong>{companyEmail}</strong>
                  </div>
                </div>
              )}
              {companyPhone && (
                <div className="bw-contact-item">
                  <Phone size={16} />
                  <div>
                    <small>Telefone / Ramal de TI</small>
                    <strong>{companyPhone}</strong>
                  </div>
                </div>
              )}
              {companyDocument && (
                <div className="bw-contact-item">
                  <Building2 size={16} />
                  <div>
                    <small>Unidade / Empresa</small>
                    <strong>{companyName}</strong>
                  </div>
                </div>
              )}
            </div>

            <div className="bw-modal-footer" style={{ marginTop: 20 }}>
              <button
                type="button"
                className="btn secondary"
                onClick={onClose}
              >
                Voltar ao Login
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
