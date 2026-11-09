import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/Forms";
import { changeOwnPassword } from "../usuarios/actions";

export default async function PerfilPage() {
  const session = await requireUser();
  return (
    <>
      <PageHeader title="Meu perfil" subtitle={`${session.name} · ${session.email}`} />
      <div className="card" style={{ maxWidth: 560 }}>
        <h2 className="mb">Alterar senha</h2>
        <ActionForm action={changeOwnPassword} submitLabel="Alterar senha" resetOnSuccess>
          <div className="form-grid">
            <div className="field s12">
              <label>Senha atual</label>
              <input name="current" type="password" autoComplete="current-password" required />
            </div>
            <div className="field">
              <label>Nova senha</label>
              <input name="next" type="password" minLength={6} autoComplete="new-password" required />
            </div>
            <div className="field">
              <label>Confirmar nova senha</label>
              <input name="confirm" type="password" minLength={6} autoComplete="new-password" required />
            </div>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
