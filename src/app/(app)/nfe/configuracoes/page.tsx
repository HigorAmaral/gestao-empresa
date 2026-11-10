import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileCheck, Key, ShieldCheck, Sparkles } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getCompanySettings } from "@/lib/audit";
import { PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/Forms";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { saveFiscalSettings } from "../actions";

export default async function NfeSettingsPage() {
  await requireAdmin("configuracoes");
  await ensureStockLocationTables();
  const company = await getCompanySettings();

  return (
    <>
      <PageHeader
        title="Configurações Fiscais de Emissão de NF-e"
        subtitle="Configure seu regime tributário, ambiente da SEFAZ (Homologação ou Produção) e integração para emissão oficial de Notas Fiscais"
        actions={
          <Link className="btn secondary" href="/nfe">
            <ArrowLeft size={16} /> Voltar para Notas Fiscais
          </Link>
        }
      />

      <div className="card">
        <ActionForm action={saveFiscalSettings} submitLabel="Salvar Configurações Fiscais">
          {/* Seção 1: Regime e Ambiente */}
          <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 6 }}>
              <ShieldCheck size={18} />
              Ambiente e Regime Tributário
            </h3>
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 16px" }}>
              Define as regras fiscais de cálculo e validação perante a Secretaria da Fazenda (SEFAZ).
            </p>

            <div className="form-grid">
              <div className="field s6">
                <label>Ambiente de Emissão da SEFAZ *</label>
                <select name="nfeEnvironment" defaultValue={company.nfeEnvironment || "HOMOLOGACAO"}>
                  <option value="HOMOLOGACAO">🟡 Homologação (Ambiente Oficial de Testes da SEFAZ)</option>
                  <option value="PRODUCAO">🟢 Produção (Emissão Real com Validade Jurídica)</option>
                </select>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  Em homologação, as notas são validadas nos servidores de teste da SEFAZ sem valor fiscal comercial.
                </div>
              </div>

              <div className="field s6">
                <label>Regime Tributário da Empresa *</label>
                <select name="taxRegime" defaultValue={company.taxRegime || "1"}>
                  <option value="1">CRT 1 — Simples Nacional (ME / EPP)</option>
                  <option value="2">CRT 2 — Simples Nacional com excesso de sublimite</option>
                  <option value="3">CRT 3 — Regime Normal (Lucro Presumido / Lucro Real)</option>
                </select>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  Gera automaticamente os grupos tributários adequados (CSOSN ou CST) no XML oficial.
                </div>
              </div>

              <div className="field s3">
                <label>Série da NF-e *</label>
                <input
                  type="number"
                  name="nfeSeries"
                  min="1"
                  max="999"
                  defaultValue={company.nfeSeries || 1}
                  required
                />
              </div>

              <div className="field s3">
                <label>Próximo Número da NF-e *</label>
                <input
                  type="number"
                  name="nfeNextNumber"
                  min="1"
                  defaultValue={company.nfeNextNumber || 1}
                  required
                />
              </div>

              <div className="field s6">
                <label>Código IBGE do Município do Emitente *</label>
                <input
                  type="text"
                  name="ibgeCityCode"
                  defaultValue={company.ibgeCityCode || "3550308"}
                  placeholder="Ex: 3550308 (São Paulo), 3304557 (Rio de Janeiro)"
                  required
                />
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  Código de 7 dígitos do IBGE onde a empresa está localizada (usado no campo cMunFG da SEFAZ).
                </div>
              </div>
            </div>
          </div>

          {/* Seção 2: Conexão SEFAZ & Gateway de Emissão Fiscal */}
          <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 6 }}>
              <Key size={18} />
              Conexão com a SEFAZ & Provedor Fiscal
            </h3>
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 16px" }}>
              Para transmissão automatizada em tempo real para qualquer uma das 27 Secretarias da Fazenda estaduais.
            </p>

            <div className="form-grid">
              <div className="field s6">
                <label>Provedor / Modo de Emissão *</label>
                <select name="nfeApiProvider" defaultValue={company.nfeApiProvider || "FOCUS_NFE"}>
                  <option value="FOCUS_NFE">Focus NFe API (Conexão direta SEFAZ todos os estados)</option>
                  <option value="NUVEM_FISCAL">Nuvem Fiscal</option>
                  <option value="WEBMANIA">WebmaniaBR Fiscal</option>
                  <option value="DIRETO_SEFAZ">Motor Nativo SEFAZ (Validador e Gerador XML MOC 4.00)</option>
                </select>
              </div>

              <div className="field s6">
                <label>Token / Chave de API do Provedor Fiscal</label>
                <input
                  type="password"
                  name="nfeApiKey"
                  defaultValue={company.nfeApiKey || ""}
                  placeholder="Cole aqui seu token de autorização SEFAZ..."
                />
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  Deixe em branco para usar o motor de validação e emissão em modo de contingência/homologação.
                </div>
              </div>

              <div className="field s6">
                <label>Identificador do CSC (IdCSC) — Opcional para NFC-e</label>
                <input
                  type="text"
                  name="nfeCscId"
                  defaultValue={company.nfeCscId || ""}
                  placeholder="Ex: 000001"
                />
              </div>

              <div className="field s6">
                <label>Código de Segurança do Contribuinte (Token CSC)</label>
                <input
                  type="text"
                  name="nfeCscToken"
                  defaultValue={company.nfeCscToken || ""}
                  placeholder="Ex: A1B2C3D4E5F6..."
                />
              </div>
            </div>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
