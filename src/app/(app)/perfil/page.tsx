import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/Forms";
import { AccessibilityControlsList } from "@/components/AccessibilityManager";
import { changeOwnPassword } from "../usuarios/actions";

export default async function PerfilPage() {
  const session = await requireUser();
  return (
    <>
      <PageHeader title="Meu perfil" subtitle={`${session.name} · ${session.email}`} />
      <div className="grid grid-2" style={{ alignItems: "start", gap: 16 }}>
        <div className="card">
          <h2 className="mb">Alterar senha</h2>
          <ActionForm action={changeOwnPassword} submitLabel="Alterar senha" resetOnSuccess>
            <div className="form-grid">
              <div className="field s12">
                <label htmlFor="cur-pass">Senha atual</label>
                <input id="cur-pass" name="current" type="password" autoComplete="current-password" required />
              </div>
              <div className="field">
                <label htmlFor="next-pass">Nova senha</label>
                <input id="next-pass" name="next" type="password" minLength={6} autoComplete="new-password" required />
              </div>
              <div className="field">
                <label htmlFor="conf-pass">Confirmar nova senha</label>
                <input id="conf-pass" name="confirm" type="password" minLength={6} autoComplete="new-password" required />
              </div>
            </div>
          </ActionForm>
        </div>

        <div className="card">
          <h2 className="mb">Acessibilidade & Conforto Visual</h2>
          <p className="small muted mb">
            Personalize o tamanho das fontes, alto contraste (WCAG AAA), redução de animações e feedback sonoro no PDV.
          </p>
          <AccessibilityControlsList />
        </div>
      </div>
    </>
  );
}
