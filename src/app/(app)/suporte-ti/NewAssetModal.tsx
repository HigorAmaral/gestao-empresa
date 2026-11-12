"use client";

import { useState } from "react";
import { Laptop, Loader2, Plus, X } from "lucide-react";
import { createAssetAction } from "./actions";

export function NewAssetModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData(e.currentTarget);
      await createAssetAction(fd);
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
        <Plus size={15} /> Novo Ativo de TI
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
                <Laptop size={18} />
                <h3>Cadastrar Ativo / Equipamento de TI</h3>
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
                    <label>
                      Nº de Patrimônio <span className="bw-req">*</span>
                    </label>
                    <input
                      name="assetTag"
                      type="text"
                      placeholder="Ex: PAT-001 ou TI-NOTE-12"
                      required
                      className="bw-modal-input"
                    />
                  </div>

                  <div className="bw-field">
                    <label>Categoria do Equipamento</label>
                    <select name="category" defaultValue="NOTEBOOK" className="bw-modal-input">
                      <option value="NOTEBOOK">💻 Notebook / Portátil</option>
                      <option value="DESKTOP">🖥️ Desktop / Computador</option>
                      <option value="MONITOR">🖥️ Monitor / Tela</option>
                      <option value="IMPRESSORA">🖨️ Impressora / Térmica</option>
                      <option value="SERVIDOR">🗄️ Servidor / Storage</option>
                      <option value="REDE">🌐 Roteador / Switch / Wi-Fi</option>
                      <option value="OUTRO">🔌 Periférico / Outro</option>
                    </select>
                  </div>
                </div>

                <div className="bw-field">
                  <label>
                    Nome / Modelo do Equipamento <span className="bw-req">*</span>
                  </label>
                  <input
                    name="name"
                    type="text"
                    placeholder="Ex: Dell Latitude 3420 / Samsung 24'' IPS"
                    required
                    className="bw-modal-input"
                  />
                </div>

                <div className="bw-form-grid-2">
                  <div className="bw-field">
                    <label>Número de Série / Service Tag</label>
                    <input
                      name="serialNumber"
                      type="text"
                      placeholder="Ex: 8FGH3K2"
                      className="bw-modal-input"
                    />
                  </div>

                  <div className="bw-field">
                    <label>Status Operacional</label>
                    <select name="status" defaultValue="EM_USO" className="bw-modal-input">
                      <option value="EM_USO">🟢 Em Uso</option>
                      <option value="DISPONIVEL">⚪ Disponível em Estoque</option>
                      <option value="MANUTENCAO">🟠 Em Manutenção</option>
                      <option value="BAIXADO">🔴 Desativado / Baixado</option>
                    </select>
                  </div>
                </div>

                <div className="bw-form-grid-2">
                  <div className="bw-field">
                    <label>Colaborador em Posse</label>
                    <input
                      name="assignedUser"
                      type="text"
                      placeholder="Ex: Juliana Rocha"
                      className="bw-modal-input"
                    />
                  </div>

                  <div className="bw-field">
                    <label>Departamento</label>
                    <input
                      name="department"
                      type="text"
                      placeholder="Ex: Vendas / Diretoria"
                      className="bw-modal-input"
                    />
                  </div>
                </div>

                <div className="bw-field">
                  <label>Especificações Técnicas</label>
                  <input
                    name="specifications"
                    type="text"
                    placeholder="Ex: Core i5 11ª Ger, 16GB RAM, 512GB SSD, Windows 11 Pro"
                    className="bw-modal-input"
                  />
                </div>

                <div className="bw-field">
                  <label>Observações Adicionais</label>
                  <textarea
                    name="notes"
                    rows={2}
                    placeholder="Termo de responsabilidade assinado, acessórios entregues, etc."
                    className="bw-modal-input"
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
                      <Loader2 size={15} className="spin-icon" /> Salvando...
                    </>
                  ) : (
                    "Cadastrar Ativo"
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
