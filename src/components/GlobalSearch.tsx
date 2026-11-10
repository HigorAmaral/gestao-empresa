"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Search, X } from "lucide-react";

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
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
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
      document.body.style.overflow = "hidden";
      setTimeout(() => inputRef.current?.focus(), 20);
    } else {
      document.body.style.overflow = "";
      setQuery("");
      setResults([]);
      setActiveIndex(0);
    }
    return () => {
      document.body.style.overflow = "";
    };
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

  const modal =
    open && mounted
      ? createPortal(
          <div className="cmd-backdrop" onClick={() => setOpen(false)}>
            <div className="cmd-modal" onClick={(e) => e.stopPropagation()}>
              <div className="cmd-input-row">
                <Search size={18} className="cmd-search-icon" />
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
                <button type="button" className="cmd-close" onClick={() => setOpen(false)} title="Fechar (Esc)">
                  <X size={16} />
                </button>
              </div>

              <div className="cmd-list">
                <div className="cmd-section-label">
                  {query.trim()
                    ? loading
                      ? "Pesquisando..."
                      : `${results.length} resultado(s) encontrado(s)`
                    : "Ações rápidas (use ↑ ↓ e Enter)"}
                </div>
                {list.map((item, idx) => (
                  <button
                    key={item.href + idx}
                    type="button"
                    className={`cmd-item ${idx === activeIndex ? "active" : ""}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => goTo(item.href)}
                  >
                    <div className="cmd-item-content">
                      <div className="cmd-item-top">
                        <span className="badge gray" style={{ fontSize: 10 }}>
                          {item.type}
                        </span>
                        <strong>{item.title}</strong>
                      </div>
                      <div className="muted small" style={{ marginTop: 2 }}>
                        {item.subtitle}
                      </div>
                    </div>
                    <ArrowRight size={15} className="muted" style={{ flexShrink: 0 }} />
                  </button>
                ))}
                {query.trim() && !loading && results.length === 0 && (
                  <div className="empty" style={{ padding: 28 }}>
                    Nenhum resultado encontrado para &ldquo;{query}&rdquo;.
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button type="button" className="sidebar-search-btn" onClick={() => setOpen(true)}>
        <span className="row" style={{ gap: 8 }}>
          <Search size={14} />
          <span>Buscar...</span>
        </span>
        <kbd>Ctrl K</kbd>
      </button>
      {modal}
    </>
  );
}
