"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Plus, Search, ShoppingCart, Users, Warehouse, Wrench, X } from "lucide-react";

type SearchResult = {
  type: string;
  title: string;
  subtitle: string;
  href: string;
};

const QUICK_ACTIONS: SearchResult[] = [
  { type: "Atalho", title: "Nova Venda / PDV", subtitle: "Registrar pedido ou orçamento", href: "/vendas/novo" },
  { type: "Atalho", title: "Nova Ordem de Serviço", subtitle: "Abrir OS na bancada", href: "/os/novo" },
  { type: "Atalho", title: "Novo Cliente", subtitle: "Cadastrar cliente na carteira", href: "/clientes/novo" },
  { type: "Atalho", title: "Novo Produto", subtitle: "Adicionar item ao catálogo", href: "/produtos/novo" },
  { type: "Atalho", title: "Consultar Estoque", subtitle: "Saldos e movimentações", href: "/estoque" },
];

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 20);
    } else {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setActiveIndex(0);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
          setActiveIndex(0);
        }
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  const list = query.trim() ? results : QUICK_ACTIONS;

  function goTo(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <button type="button" className="sidebar-search-btn" onClick={() => setOpen(true)}>
        <span className="row" style={{ gap: 8 }}>
          <Search size={14} />
          <span>Buscar no sistema...</span>
        </span>
        <kbd>Ctrl K</kbd>
      </button>

      {open && (
        <div className="cmd-backdrop" onClick={() => setOpen(false)}>
          <div className="cmd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cmd-input-row">
              <Search size={17} className="muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busque por cliente, produto, SKU, nº da venda ou OS..."
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveIndex((i) => (list.length ? (i + 1) % list.length : 0));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveIndex((i) => (list.length ? (i - 1 + list.length) % list.length : 0));
                  } else if (e.key === "Enter" && list[activeIndex]) {
                    e.preventDefault();
                    goTo(list[activeIndex].href);
                  }
                }}
              />
              <button type="button" className="cmd-close" onClick={() => setOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="cmd-list">
              <div className="cmd-section-label">
                {query.trim()
                  ? loading
                    ? "Pesquisando..."
                    : `${results.length} resultado(s) encontrado(s)`
                  : "Ações rápidas"}
              </div>
              {list.map((item, idx) => (
                <button
                  key={item.href + idx}
                  type="button"
                  className={`cmd-item ${idx === activeIndex ? "active" : ""}`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => goTo(item.href)}
                >
                  <div>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="badge gray" style={{ fontSize: 10 }}>
                        {item.type}
                      </span>
                      <strong>{item.title}</strong>
                    </div>
                    <div className="muted small" style={{ marginTop: 2 }}>
                      {item.subtitle}
                    </div>
                  </div>
                  <ArrowRight size={14} className="muted" />
                </button>
              ))}
              {query.trim() && !loading && results.length === 0 && (
                <div className="empty" style={{ padding: 24 }}>
                  Nenhum resultado encontrado para &ldquo;{query}&rdquo;.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
