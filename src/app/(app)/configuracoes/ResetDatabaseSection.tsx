"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { resetDatabaseAction } from "./actions";

export function ResetDatabaseSection() {
  const [state, action, pending] = useActionState(resetDatabaseAction, undefined);
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div
      className="card"
      style={{
        marginTop: 24,
        borderColor: "rgba(239, 68, 68, 0.4)",
        background: "linear-gradient(to bottom, #fff, #fef2f2)",
      }}
    >
      <div className="card-header" style={{ flexWrap: "wrap" }}>
        <h2 style={{ color: "#b91c1c", display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={20} color="#dc2626" /> Zona de Manutenção & Limpeza de Dados
        </h2>
        <span className="badge danger">Ação Crítica</span>
      </div>

      <p className="small" style={{ color: "#7f1d1d", marginBottom: 16 }}>
        Esta operação apaga todos os dados de teste e movimentações operacionais (vendas, orçamentos, produtos, clientes,
        fornecedores, notas fiscais, contratos, ordens de serviço, produção e lançamentos financeiros).
        <br />
        <strong>Serão preservados exclusivamente:</strong>
      </p>

      <ul
        style={{
          fontSize: 13,
          color: "#991b1b",
          marginBottom: 16,
          paddingLeft: 20,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <li>
          👑 <strong>Administrador Principal:</strong> Higor do Amaral Fritz (acesso total garantido)
        </li>
        <li>
          ⚡ <strong>Acessos Rápidos da Tela de Login:</strong> Administrador (<code>admin@empresa.com</code>) e Funcionário (<code>func@empresa.com</code>)
        </li>
        <li>
          🏢 <strong>Identidade Visual da Empresa:</strong> Logotipo, cores personalizadas e CNPJ configurados
        </li>
      </ul>

      {state?.error && (
        <div className="alert error mb" style={{ marginBottom: 16 }}>
          {state.error}
        </div>
      )}

      {state?.success && (
        <div
          className="alert success mb"
          style={{
            marginBottom: 16,
            background: "#ecfdf5",
            borderColor: "#10b981",
            color: "#065f46",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <CheckCircle2 size={18} color="#059669" />
          {state.success}
        </div>
      )}

      <form action={action} onSubmit={(e) => {
        if (!confirmed) {
          e.preventDefault();
          const ok = window.confirm(
            "ATENÇÃO: Confirma a exclusão de todas as movimentações e dados de teste, mantendo apenas os logins de Higor e acessos rápidos?"
          );
          if (ok) {
            setConfirmed(true);
            setTimeout(() => {
              (e.target as HTMLFormElement).requestSubmit();
            }, 50);
          }
        }
      }}>
        <button
          type="submit"
          className="btn danger"
          disabled={pending}
          style={{
            background: "#dc2626",
            borderColor: "#b91c1c",
            color: "#fff",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            cursor: pending ? "wait" : "pointer",
          }}
        >
          {pending ? (
            <>
              <Loader2 size={16} className="spin-icon" /> Executando Limpeza do Banco...
            </>
          ) : (
            <>
              <Trash2 size={16} /> Limpar Dados e Manter Apenas Administrador
            </>
          )}
        </button>
      </form>
    </div>
  );
}
