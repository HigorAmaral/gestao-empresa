"use client";

import { useActionState } from "react";
import { Building2, LogIn } from "lucide-react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <div className="login-page">
      <form className="login-card" action={action}>
        <div className="brand">
          <div className="logo">
            <Building2 size={22} />
          </div>
          <div>
            <h1>GestãoPro</h1>
            <div className="muted small">Sistema de Gerenciamento Empresarial</div>
          </div>
        </div>

        {state?.error && <div className="alert error">{state.error}</div>}

        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button className="btn" disabled={pending}>
          <LogIn size={16} /> {pending ? "Entrando..." : "Entrar"}
        </button>

        <div className="hint">
          <strong>Acesso de demonstração</strong>
          <br />
          Admin: admin@empresa.com / admin123
          <br />
          Funcionário: func@empresa.com / func123
        </div>
      </form>
    </div>
  );
}
