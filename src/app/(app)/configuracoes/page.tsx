import { Database, Download, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getCompanySettings } from "@/lib/audit";
import { PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/Forms";
import { saveCompanySettings } from "./actions";
import { LogoUploadField } from "./LogoUploadField";
import { ColorThemeCustomizer } from "./ColorThemeCustomizer";
import { CompanyFiscalLookupFields } from "./CompanyFiscalLookupFields";
import { ResetDatabaseSection } from "./ResetDatabaseSection";

export default async function ConfiguracoesPage() {
  await requireAdmin("configuracoes");
  const [company, clientsCount, productsCount, salesCount, finCount] = await Promise.all([
    getCompanySettings(),
    prisma.client.count(),
    prisma.product.count(),
    prisma.sale.count(),
    prisma.financialEntry.count(),
  ]);

  return (
    <>
      <PageHeader
        title="Configurações da Empresa & Governança"
        subtitle="Configure a logo, as cores do sistema, dados cadastrais com busca de CNPJ/CEP e exporte backups completos"
        actions={
          <a className="btn" href="/api/backup" download>
            <Download size={15} /> Backup Completo (.JSON)
          </a>
        }
      />

      <div className="card mb">
        <ActionForm action={saveCompanySettings} submitLabel="Salvar Configurações">
          {/* Seção 1: Logo da Empresa */}
          <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid var(--border)" }}>
            <LogoUploadField initialLogoUrl={company.logoUrl} />
          </div>

          {/* Seção 2: Personalização de Cores do Site */}
          <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: "1px solid var(--border)" }}>
            <ColorThemeCustomizer
              initialPrimary={company.primaryColor}
              initialSidebar={company.sidebarColor}
              initialAccent={company.accentColor}
            />
          </div>

          {/* Seção 3: Dados Cadastrais e Fiscais com Busca Automática de CNPJ/CEP */}
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
              Dados Cadastrais & Fiscais da Empresa (com consulta automática Receita / ViaCEP)
            </h3>
            <CompanyFiscalLookupFields company={company} />
          </div>
        </ActionForm>
      </div>

      {/* Seção 4: Segurança, Governança & Backup Completo em 1 Clique */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap" }}>
          <h2>
            <Database size={18} /> Segurança, Governança & Backup Completo dos Dados
          </h2>
          <span className="badge success">
            <ShieldCheck size={13} /> Banco PostgreSQL Sincronizado
          </span>
        </div>

        <p className="small muted mb">
          Exporte a qualquer momento uma cópia integral de segurança de todos os módulos do sistema (Cadastros, Vendas,
          NF-e, Ordens de Serviço, Produção, Estoque, WMS e Financeiro) em formato estruturado <code>.JSON</code> ou em
          planilhas <code>.CSV / Excel</code>.
        </p>

        <div className="stats mb">
          <div className="stat">
            <div className="label">Clientes Cadastrados</div>
            <div className="value">{clientsCount}</div>
          </div>
          <div className="stat">
            <div className="label">Produtos & Insumos</div>
            <div className="value">{productsCount}</div>
          </div>
          <div className="stat">
            <div className="label">Vendas & Orçamentos</div>
            <div className="value">{salesCount}</div>
          </div>
          <div className="stat">
            <div className="label">Lançamentos Financeiros</div>
            <div className="value">{finCount}</div>
          </div>
        </div>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <a className="btn" href="/api/backup" download>
            <Download size={16} /> Baixar Backup Geral do Sistema (.JSON)
          </a>
          <a className="btn secondary" href="/api/export?entity=vendas">
            <FileSpreadsheet size={15} /> Planilha de Vendas (.CSV)
          </a>
          <a className="btn secondary" href="/api/export?entity=produtos">
            <FileSpreadsheet size={15} /> Planilha de Produtos (.CSV)
          </a>
          <a className="btn secondary" href="/api/export?entity=clientes">
            <FileSpreadsheet size={15} /> Planilha de Clientes (.CSV)
          </a>
          <a className="btn secondary" href="/api/export?entity=financeiro">
            <FileSpreadsheet size={15} /> Planilha do Financeiro (.CSV)
          </a>
        </div>
      </div>

      <ResetDatabaseSection />
    </>
  );
}
