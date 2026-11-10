"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui";

export default function EnderecamentoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erro na página de endereçamento:", error);
  }, [error]);

  return (
    <>
      <PageHeader
        title="Endereçamento de Estoque"
        subtitle="Ocorreu uma instabilidade ao carregar a página de endereçamento"
        actions={
          <Link className="btn secondary" href="/estoque">
            <ArrowLeft size={15} /> Voltar ao Estoque
          </Link>
        }
      />

      <div className="card" style={{ maxWidth: 650, margin: "20px auto", textAlign: "center", padding: "40px 24px" }}>
        <div style={{ display: "inline-flex", padding: 16, borderRadius: "50%", background: "#f4f4f5", marginBottom: 16 }}>
          <AlertTriangle size={36} className="text-danger" />
        </div>
        <h2 style={{ justifyContent: "center", marginBottom: 8 }}>Não foi possível carregar os dados de endereçamento</h2>
        <p className="muted" style={{ marginBottom: 20 }}>
          {error.message?.includes("does not exist") || error.message?.includes("relation")
            ? "As tabelas de endereçamento estão sendo sincronizadas com o banco de dados. Clique no botão abaixo para tentar novamente."
            : error.message || "Erro interno de comunicação com o servidor."}
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
          <button className="btn" onClick={() => reset()}>
            <RefreshCw size={15} /> Tentar Novamente
          </button>
          <Link className="btn secondary" href="/estoque">
            Ir para Movimentações de Estoque
          </Link>
        </div>
      </div>
    </>
  );
}
