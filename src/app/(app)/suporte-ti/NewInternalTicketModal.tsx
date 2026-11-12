"use client";

import { useState } from "react";
import { Headphones, Loader2, Plus, Send, X } from "lucide-react";
import { createInternalTicketAction } from "./actions";

export function NewInternalTicketModal({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData(e.currentTarget);
      await createInternalTicketAction(fd);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="btn"
        onClick={() => setOpen(true)}
      >
        <Plus size={15} /> Abrir Chamado Interno
      </button>

      {open && (
        <div className="bw-modal-overlay" onClick={() => setOpen(false)}>
          <div
            className="bw-modal-card"
            style={{ maxWidth: 560 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bw-modal-header">
              <div className="bw-modal-title">
                <Headphones size={18} />
                <h3>Novo Chamado de Suporte TI</h3>
              </div>
              <button
                type="button"
                className="bw-modal-close"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="bw-modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="bw-form-grid-2">
                  <div className="bw-field">
                    <label>Solicitante</label>
                    <input
                      name="requesterName"
                      type="text"
                      defaultValue={userName}
                      required
                      className="bw-modal-input"
                    />
                  </div>
                  <div className="bw-field">
                    <label>Departamento</label>
                    <select name="department" defaultValue="Geral" className="bw-modal-input">
                      <option value="Vendas">Vendas / Comercial</option>
                      <option value="Financeiro">Financeiro / Controladoria</option>
                      <option value="RH">Recursos Humanos (RH)</option>
                      <option value="Estoque">Estoque & Logística (WMS)</option>
                      <option value="Producao">Produção & Fábrica (PCP)</option>
                      <option value="Assistencia">Assistência Técnica (OS)</option>
                      <option value="TI">Tecnologia da Informação (TI)</option>
                      <option value="Geral">Geral</option>
                    </select>
                  </div>
                </div>

                <div className="bw-form-grid-2">
                  <div className="bw-field">
                    <label>E-mail para Notificação</label>
                    <input
                      name="requesterEmail"
                      type="email"
                      placeholder="email@empresa.com"
                      className="bw-modal-input"
                    />
                  </div>
                  <div className="bw-field">
                    <label>WhatsApp / Telefone</label>
                    <input
                      name="requesterPhone"
                      type="tel"
                      placeholder="(11) 98765-4321"
                      className="bw-modal-input"
                    />
                  </div>
                </div>

                <div className="bw-form-grid-2">
                  <div className="bw-field">
                    <label>Categoria</label>
                    <select name="category" defaultValue="SISTEMA_ERRO" className="bw-modal-input">
                      <option value="ACESSO_SENHA">🔑 Senha / Acesso Bloqueado</option>
                      <option value="SISTEMA_ERRO">⚙️ Erro no Sistema ERP</option>
                      <option value="EQUIPAMENTO_HARDWARE">💻 Computador / Impressora</option>
                      <option value="REDE_INTERNET">🌐 Rede / Internet</option>
                      <option value="INSTALACAO_SOFTWARE">📋 Software / Permissão</option>
                      <option value="OUTRO">❓ Outro</option>
                    </select>
                  </div>
                  <div className="bw-field">
                    <label>Prioridade</label>
                    <select name="priority" defaultValue="NORMAL" className="bw-modal-input">
                      <option value="BAIXA">🟢 Baixa</option>
                      <option value="NORMAL">⚪ Normal</option>
                      <option value="ALTA">🟠 Alta</option>
                      <option value="URGENTE">🔴 Urgente</option>
                    </select>
                  </div>
                </div>

                <div className="bw-field">
                  <label>Assunto do Chamado</label>
                  <input
                    name="title"
                    type="text"
                    placeholder="Título breve da ocorrência"
                    required
                    className="bw-modal-input"
                  />
                </div>

                <div className="bw-field">
                  <label>Descrição do Problema</label>
                  <textarea
                    name="description"
                    rows={3}
                    placeholder="Descreva detalhadamente o problema ou solicitação..."
                    required
                    className="bw-modal-input"
                    style={{ resize: "vertical" }}
                  />
                </div>
              </div>

              <div className="bw-modal-footer">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="spin-icon" /> Abrindo...
                    </>
                  ) : (
                    <>
                      <Send size={15} /> Registrar Chamado
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
