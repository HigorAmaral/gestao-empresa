import { requireAdmin } from "@/lib/auth";
import { getCompanySettings } from "@/lib/audit";
import { UFS } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/Forms";
import { saveCompanySettings } from "./actions";

export default async function ConfiguracoesPage() {
  await requireAdmin("configuracoes");
  const company = await getCompanySettings();

  return (
    <>
      <PageHeader
        title="Configurações da Empresa"
        subtitle="Estes dados aparecem no cabeçalho dos recibos, tela de login, barra lateral e metas do Dashboard"
      />

      <div className="card">
        <ActionForm action={saveCompanySettings} submitLabel="Salvar configurações">
          <div className="form-grid">
            <div className="field s6">
              <label>Razão Social *</label>
              <input name="name" defaultValue={company.name} required />
            </div>
            <div className="field s3">
              <label>Nome Fantasia</label>
              <input name="tradeName" defaultValue={company.tradeName ?? ""} />
            </div>
            <div className="field s3">
              <label>Meta Mensal de Faturamento (R$)</label>
              <input
                name="monthlyGoal"
                type="number"
                step="100"
                min="0"
                defaultValue={company.monthlyGoal ?? 30000}
              />
            </div>
            <div className="field s4">
              <label>CNPJ</label>
              <input name="document" defaultValue={company.document ?? ""} />
            </div>
            <div className="field s4">
              <label>Inscrição Estadual</label>
              <input name="stateRegistration" defaultValue={company.stateRegistration ?? ""} />
            </div>
            <div className="field s4">
              <label>Telefone / WhatsApp</label>
              <input name="phone" defaultValue={company.phone ?? ""} />
            </div>
            <div className="field">
              <label>E-mail comercial</label>
              <input name="email" type="email" defaultValue={company.email ?? ""} />
            </div>
            <div className="field">
              <label>Site</label>
              <input name="website" defaultValue={company.website ?? ""} />
            </div>
            <div className="field s8">
              <label>Endereço</label>
              <input name="address" defaultValue={company.address ?? ""} />
            </div>
            <div className="field s4">
              <label>CEP</label>
              <input name="zipCode" defaultValue={company.zipCode ?? ""} />
            </div>
            <div className="field s8">
              <label>Cidade</label>
              <input name="city" defaultValue={company.city ?? ""} />
            </div>
            <div className="field s4">
              <label>UF</label>
              <select name="state" defaultValue={company.state ?? ""}>
                <option value="">—</option>
                {UFS.map((uf) => (
                  <option key={uf}>{uf}</option>
                ))}
              </select>
            </div>
            <div className="field s12">
              <label>Texto de rodapé nos recibos / Ordens de Serviço</label>
              <textarea name="receiptFooter" defaultValue={company.receiptFooter ?? ""} />
            </div>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
