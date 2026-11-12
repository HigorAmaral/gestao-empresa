"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  Camera,
  CheckCircle2,
  CreditCard,
  Lock,
  Minus,
  Plus,
  Printer,
  QrCode,
  Search,
  ShoppingCart,
  Split,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { brl } from "@/lib/format";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";
import {
  cashMovementAction,
  closeCashSessionAction,
  completePdvSaleAction,
  openCashSessionAction,
} from "./actions";

export type PdvProduct = {
  id: number;
  sku: string;
  name: string;
  category: string | null;
  unit: string;
  salePrice: number;
  stock: number;
};

export type PdvClientOption = {
  id: number;
  name: string;
  document: string | null;
};

export type PdvCashSession = {
  id: number;
  userName: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  openingBalance: number;
  closingBalance: number | null;
  totalCash: number;
  totalPix: number;
  totalCard: number;
  totalOther: number;
  withdrawals: number;
  supplies: number;
  salesCount: number;
  notes: string | null;
};

type CartItem = {
  product: PdvProduct;
  quantity: number;
  unitPrice: number;
};

export function PdvClient({
  products,
  clients,
  activeSession,
  recentSessions,
}: {
  products: PdvProduct[];
  clients: PdvClientOption[];
  activeSession: PdvCashSession | null;
  recentSessions: PdvCashSession[];
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [discount, setDiscount] = useState<string>("0");
  const [paymentMethod, setPaymentMethod] = useState<string>("PIX");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [useSplit, setUseSplit] = useState(false);
  const [splitMethod1, setSplitMethod1] = useState("PIX");
  const [splitAmount1, setSplitAmount1] = useState("");
  const [splitMethod2, setSplitMethod2] = useState("Cartão de Crédito");
  const [notes, setNotes] = useState("");

  const [scannerOpen, setScannerOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string; saleId?: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Modais de Caixa
  const [openModal, setOpenModal] = useState(false);
  const [openingInput, setOpeningInput] = useState("200");
  const [movModal, setMovModal] = useState<"SANGRIA" | "SUPRIMENTO" | null>(null);
  const [movAmount, setMovAmount] = useState("");
  const [movReason, setMovReason] = useState("");
  const [closeModal, setCloseModal] = useState(false);
  const [closingInput, setClosingInput] = useState("");
  const [closingNotes, setClosingNotes] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter && p.category !== categoryFilter) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    });
  }, [products, search, categoryFilter]);

  const subtotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0),
    [cart],
  );
  const discountVal = Math.max(0, Math.min(subtotal, parseFloat(discount.replace(",", ".")) || 0));
  const total = Math.max(0, subtotal - discountVal);

  const cashReceivedVal = parseFloat(cashReceived.replace(",", ".")) || 0;
  const changeAmount = paymentMethod === "Dinheiro" && cashReceivedVal > total ? cashReceivedVal - total : 0;

  const splitVal1 = parseFloat(splitAmount1.replace(",", ".")) || 0;
  const splitVal2 = Math.max(0, Number((total - splitVal1).toFixed(2)));

  const expectedCashInDrawer = activeSession
    ? activeSession.openingBalance + activeSession.totalCash + activeSession.supplies - activeSession.withdrawals
    : 0;

  const totalSessionSales = activeSession
    ? activeSession.totalCash + activeSession.totalPix + activeSession.totalCard + activeSession.totalOther
    : 0;

  // Atalhos de teclado F2 (Buscar) e F4 (Finalizar)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function addToCart(prod: PdvProduct) {
    setFeedback(null);
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === prod.id);
      if (existing) {
        if (existing.quantity + 1 > prod.stock) {
          setFeedback({ type: "error", text: `Estoque máximo atingido para "${prod.name}" (${prod.stock} ${prod.unit}).` });
          return prev;
        }
        return prev.map((i) => (i.product.id === prod.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      if (prod.stock <= 0) {
        setFeedback({ type: "error", text: `Produto "${prod.name}" está sem estoque disponível.` });
        return prev;
      }
      return [...prev, { product: prod, quantity: 1, unitPrice: prod.salePrice }];
    });
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const q = search.trim().toLowerCase();
      if (!q) return;
      const exactSku = products.find((p) => p.sku.toLowerCase() === q);
      if (exactSku) {
        addToCart(exactSku);
        setSearch("");
      } else if (filteredProducts.length === 1) {
        addToCart(filteredProducts[0]);
        setSearch("");
      }
    }
  }

  function handleBarcodeDetected(code: string) {
    setScannerOpen(false);
    const cleaned = code.trim().toLowerCase();
    const match = products.find((p) => p.sku.toLowerCase() === cleaned || p.name.toLowerCase().includes(cleaned));
    if (match) {
      addToCart(match);
    } else {
      setSearch(code);
      setFeedback({ type: "error", text: `Código "${code}" lido, mas nenhum SKU exato foi localizado.` });
    }
  }

  function updateQty(productId: number, nextQty: number) {
    if (nextQty <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((i) => {
        if (i.product.id !== productId) return i;
        const clamped = Math.min(i.product.stock, nextQty);
        return { ...i, quantity: clamped };
      }),
    );
  }

  function handleCheckout() {
    if (cart.length === 0) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await completePdvSaleAction({
        clientId: clientId ? Number(clientId) : null,
        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        discount: discountVal,
        paymentMethod,
        splitDetails: useSplit
          ? { method1: splitMethod1, amount1: splitVal1, method2: splitMethod2, amount2: splitVal2 }
          : null,
        notes,
      });

      if (res.error) {
        setFeedback({ type: "error", text: res.error });
      } else if (res.ok && res.saleId) {
        setCart([]);
        setDiscount("0");
        setCashReceived("");
        setSplitAmount1("");
        setNotes("");
        setFeedback({
          type: "ok",
          text: `Venda PDV #${res.saleId} concluída com sucesso! Estoque e financeiro atualizados.`,
          saleId: res.saleId,
        });
      }
    });
  }

  function handleOpenCash(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await openCashSessionAction(parseFloat(openingInput) || 0);
      if (res.error) setFeedback({ type: "error", text: res.error });
      else setOpenModal(false);
    });
  }

  function handleCashMovement(e: React.FormEvent) {
    e.preventDefault();
    if (!movModal) return;
    startTransition(async () => {
      const res = await cashMovementAction(movModal, parseFloat(movAmount) || 0, movReason);
      if (res.error) setFeedback({ type: "error", text: res.error });
      else {
        setMovModal(null);
        setMovAmount("");
        setMovReason("");
      }
    });
  }

  function handleCloseCash(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await closeCashSessionAction(
        parseFloat(closingInput) || expectedCashInDrawer,
        closingNotes,
      );
      if (res.error) setFeedback({ type: "error", text: res.error });
      else {
        setCloseModal(false);
        setClosingInput("");
        setClosingNotes("");
      }
    });
  }

  return (
    <div>
      {/* Barra de Controle de Turno / Gaveta de Caixa */}
      <div className="card mb">
        <div className="row between" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            {activeSession ? (
              <>
                <span className="badge success" style={{ fontSize: 13, padding: "6px 12px" }}>
                  <Unlock size={14} /> CAIXA #{activeSession.id} ABERTO ({activeSession.userName})
                </span>
                <div className="small">
                  <span className="muted">Fundo Inicial:</span> <strong>{brl(activeSession.openingBalance)}</strong>
                </div>
                <div className="small">
                  <span className="muted">Vendas no Turno ({activeSession.salesCount}):</span>{" "}
                  <strong>{brl(totalSessionSales)}</strong>
                </div>
                <div className="small">
                  <span className="muted">Dinheiro na Gaveta:</span>{" "}
                  <strong style={{ color: "var(--primary)" }}>{brl(expectedCashInDrawer)}</strong>
                </div>
              </>
            ) : (
              <span className="badge warning" style={{ fontSize: 13, padding: "6px 12px" }}>
                <Lock size={14} /> CAIXA FECHADO (Você ainda pode vender ou abrir o turno para controle de gaveta)
              </span>
            )}
          </div>

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {!activeSession ? (
              <button type="button" className="btn sm" onClick={() => setOpenModal(true)}>
                <Unlock size={14} /> Abrir Caixa
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn sm secondary"
                  onClick={() => {
                    setMovModal("SUPRIMENTO");
                    setMovAmount("");
                    setMovReason("");
                  }}
                >
                  <ArrowUpCircle size={14} /> Suprimento
                </button>
                <button
                  type="button"
                  className="btn sm secondary"
                  onClick={() => {
                    setMovModal("SANGRIA");
                    setMovAmount("");
                    setMovReason("");
                  }}
                >
                  <ArrowDownCircle size={14} /> Sangria
                </button>
                <button
                  type="button"
                  className="btn sm danger"
                  onClick={() => {
                    setClosingInput(expectedCashInDrawer.toFixed(2));
                    setCloseModal(true);
                  }}
                >
                  <Lock size={14} /> Fechar Caixa
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {feedback && (
        <div className={`alert ${feedback.type === "ok" ? "success" : "error"} mb row between`} style={{ flexWrap: "wrap" }}>
          <span>
            {feedback.type === "ok" && <CheckCircle2 size={16} className="icon-inline" />} {feedback.text}
          </span>
          {feedback.saleId && (
            <div className="row" style={{ gap: 8 }}>
              <Link className="btn sm" href={`/vendas/${feedback.saleId}/recibo`}>
                <Printer size={14} /> Imprimir Cupom / Recibo
              </Link>
              <Link className="btn sm secondary" href={`/vendas/${feedback.saleId}`}>
                Ver Venda #{feedback.saleId}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Layout Principal do PDV: Catálogo à Esquerda + Carrinho/Caixa à Direita */}
      <div className="grid grid-2" style={{ gridTemplateColumns: "1.35fr 1fr", alignItems: "start" }}>
        {/* Coluna Esquerda: Busca por Código de Barras + Produtos */}
        <div className="card">
          <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <div className="input-icon" style={{ flex: 1, minWidth: 200 }}>
              <Search size={16} />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Bipe o código de barras (SKU) e tecle Enter, ou busque pelo nome (F2)..."
                autoFocus
              />
            </div>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setScannerOpen(true)}
              title="Ler Código de Barras pela Câmera"
            >
              <Camera size={16} /> Ler Código
            </button>
          </div>

          {categories.length > 0 && (
            <div className="period-pills mb" style={{ flexWrap: "wrap" }}>
              <button
                type="button"
                className={`pill ${categoryFilter === "" ? "active" : ""}`}
                onClick={() => setCategoryFilter("")}
              >
                Todos ({products.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`pill ${categoryFilter === cat ? "active" : ""}`}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(185px, 1fr))",
              gap: 10,
              maxHeight: 520,
              overflowY: "auto",
              paddingRight: 4,
            }}
          >
            {filteredProducts.map((p) => {
              const outOfStock = p.stock <= 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={outOfStock}
                  onClick={() => addToCart(p)}
                  style={{
                    textAlign: "left",
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: outOfStock ? "var(--surface-subtle)" : "var(--surface)",
                    opacity: outOfStock ? 0.55 : 1,
                    cursor: outOfStock ? "not-allowed" : "pointer",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 8,
                    transition: "border-color 0.15s, transform 0.1s",
                  }}
                >
                  <div>
                    <div className="row between" style={{ gap: 4 }}>
                      <span className="small muted bold">{p.sku}</span>
                      <span className={`badge ${outOfStock ? "danger" : "neutral"}`} style={{ fontSize: 10 }}>
                        {p.stock} {p.unit}
                      </span>
                    </div>
                    <div className="bold" style={{ fontSize: 13.5, marginTop: 4, lineHeight: 1.3 }}>
                      {p.name}
                    </div>
                  </div>
                  <div className="bold" style={{ fontSize: 15, color: "var(--text)" }}>
                    {brl(p.salePrice)}
                  </div>
                </button>
              );
            })}
            {filteredProducts.length === 0 && (
              <div className="empty" style={{ gridColumn: "1 / -1" }}>
                Nenhum produto encontrado para &ldquo;{search}&rdquo;.
              </div>
            )}
          </div>
        </div>

        {/* Coluna Direita: Cupom / Carrinho e Fechamento */}
        <div className="card">
          <div className="card-header">
            <h2>
              <ShoppingCart size={17} /> Cupom de Venda ({cart.reduce((s, i) => s + i.quantity, 0)} itens)
            </h2>
            {cart.length > 0 && (
              <button type="button" className="btn sm ghost" onClick={() => setCart([])}>
                <Trash2 size={14} /> Limpar
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="empty" style={{ padding: "36px 16px" }}>
              Bipe ou clique nos produtos ao lado para iniciar a venda rápida.
            </div>
          ) : (
            <div className="table-wrap" style={{ maxHeight: 260, overflowY: "auto", marginBottom: 14 }}>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="num">Qtd</th>
                    <th className="num">Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.product.id}>
                      <td>
                        <div className="bold" style={{ fontSize: 13 }}>
                          {item.product.name}
                        </div>
                        <div className="small muted">
                          {item.product.sku} • {brl(item.unitPrice)}/{item.product.unit}
                        </div>
                      </td>
                      <td className="num">
                        <div className="row" style={{ justifyContent: "flex-end", gap: 4 }}>
                          <button
                            type="button"
                            className="btn sm secondary"
                            style={{ padding: "3px 7px" }}
                            onClick={() => updateQty(item.product.id, item.quantity - 1)}
                          >
                            <Minus size={12} />
                          </button>
                          <span className="bold" style={{ minWidth: 26, textAlign: "center" }}>
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            className="btn sm secondary"
                            style={{ padding: "3px 7px" }}
                            onClick={() => updateQty(item.product.id, item.quantity + 1)}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="num bold">{brl(item.quantity * item.unitPrice)}</td>
                      <td className="num">
                        <button
                          type="button"
                          className="btn sm ghost"
                          onClick={() => updateQty(item.product.id, 0)}
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Dados de Cliente, Desconto e Pagamento */}
          <div className="form-grid" style={{ gap: 10 }}>
            <div className="field s8">
              <label>Cliente (Opcional)</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Consumidor Final (Balcão)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.document ? `(${c.document})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="field s4">
              <label>Desconto (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>

            <div className="field s12">
              <div className="row between" style={{ marginBottom: 6 }}>
                <label style={{ margin: 0 }}>Forma de Pagamento</label>
                <label className="checkbox small" style={{ fontWeight: 500 }}>
                  <input type="checkbox" checked={useSplit} onChange={(e) => setUseSplit(e.target.checked)} />
                  <Split size={13} /> Dividir em 2 formas de pagamento
                </label>
              </div>

              {!useSplit ? (
                <div className="period-pills" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                  {[
                    { id: "PIX", label: "PIX", Icon: QrCode },
                    { id: "Dinheiro", label: "Dinheiro", Icon: Banknote },
                    { id: "Cartão de Crédito", label: "Crédito", Icon: CreditCard },
                    { id: "Cartão de Débito", label: "Débito", Icon: CreditCard },
                  ].map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      className={`btn sm ${paymentMethod === id ? "" : "secondary"}`}
                      style={{ justifyContent: "center" }}
                      onClick={() => setPaymentMethod(id)}
                    >
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="form-grid" style={{ padding: 10, borderRadius: 8, background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                  <div className="field s6">
                    <label>1º Meio de Pagamento</label>
                    <select value={splitMethod1} onChange={(e) => setSplitMethod1(e.target.value)}>
                      <option>PIX</option>
                      <option>Dinheiro</option>
                      <option>Cartão de Crédito</option>
                      <option>Cartão de Débito</option>
                    </select>
                  </div>
                  <div className="field s6">
                    <label>Valor 1º Pagamento (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={splitAmount1}
                      onChange={(e) => setSplitAmount1(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="field s6">
                    <label>2º Meio de Pagamento</label>
                    <select value={splitMethod2} onChange={(e) => setSplitMethod2(e.target.value)}>
                      <option>Cartão de Crédito</option>
                      <option>Cartão de Débito</option>
                      <option>PIX</option>
                      <option>Dinheiro</option>
                    </select>
                  </div>
                  <div className="field s6">
                    <label>Restante 2º Pagamento</label>
                    <input value={brl(splitVal2)} readOnly style={{ fontWeight: 700 }} />
                  </div>
                </div>
              )}
            </div>

            {!useSplit && paymentMethod === "Dinheiro" && (
              <div className="field s12">
                <div
                  className="row between"
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "var(--surface-subtle)",
                    border: "1px solid var(--border)",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label className="small muted">Valor Recebido em Espécie (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Ex: 100.00"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                    />
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="small muted">TROCO A DEVOLVER</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{brl(changeAmount)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Resumo Total e Botão Finalizar */}
          <div
            style={{
              marginTop: 16,
              padding: "14px 16px",
              borderRadius: 10,
              background: "var(--primary)",
              color: "var(--primary-fg)",
            }}
          >
            <div className="row between small" style={{ opacity: 0.85 }}>
              <span>Subtotal: {brl(subtotal)}</span>
              <span>Desconto: -{brl(discountVal)}</span>
            </div>
            <div className="row between" style={{ marginTop: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>TOTAL A PAGAR</span>
              <span style={{ fontSize: 26, fontWeight: 800 }}>{brl(total)}</span>
            </div>
          </div>

          <button
            type="button"
            className="btn"
            disabled={cart.length === 0 || isPending}
            onClick={handleCheckout}
            style={{
              width: "100%",
              marginTop: 12,
              padding: "13px 18px",
              fontSize: 15,
              fontWeight: 700,
              justifyContent: "center",
            }}
          >
            <CheckCircle2 size={18} />
            {isPending ? "Processando Venda..." : "Finalizar Venda Rápida (Baixar Estoque + Recibo)"}
          </button>
        </div>
      </div>

      {/* Histórico de Fechamentos de Caixa */}
      {recentSessions.length > 0 && (
        <div className="card flush mt">
          <div className="card-header">
            <h2>Histórico de Turnos / Sessões de Caixa PDV</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Caixa</th>
                  <th>Operador</th>
                  <th>Abertura</th>
                  <th>Fechamento</th>
                  <th className="num">Fundo Inicial</th>
                  <th className="num">Dinheiro</th>
                  <th className="num">PIX</th>
                  <th className="num">Cartão</th>
                  <th className="num">Sangrias</th>
                  <th className="num">Conferido</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((s) => (
                  <tr key={s.id}>
                    <td className="bold">#{s.id}</td>
                    <td>{s.userName}</td>
                    <td className="small">{new Date(s.openedAt).toLocaleString("pt-BR")}</td>
                    <td className="small">{s.closedAt ? new Date(s.closedAt).toLocaleString("pt-BR") : "—"}</td>
                    <td className="num">{brl(s.openingBalance)}</td>
                    <td className="num">{brl(s.totalCash)}</td>
                    <td className="num">{brl(s.totalPix)}</td>
                    <td className="num">{brl(s.totalCard)}</td>
                    <td className="num">{brl(s.withdrawals)}</td>
                    <td className="num bold">{s.closingBalance != null ? brl(s.closingBalance) : "—"}</td>
                    <td>
                      <span className={`badge ${s.status === "ABERTO" ? "success" : "neutral"}`}>{s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Abrir Caixa */}
      {openModal && (
        <div className="cmd-backdrop" style={{ zIndex: 1000 }} onClick={() => setOpenModal(false)}>
          <div className="card" style={{ width: "min(420px, 92vw)" }} onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h2>
                <Unlock size={17} /> Abrir Turno de Caixa
              </h2>
              <button type="button" className="btn sm ghost" onClick={() => setOpenModal(false)}>
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleOpenCash}>
              <div className="field">
                <label>Fundo de Troco Inicial na Gaveta (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={openingInput}
                  onChange={(e) => setOpeningInput(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-actions mt">
                <button type="button" className="btn secondary" onClick={() => setOpenModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn" disabled={isPending}>
                  Confirmar Abertura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sangria / Suprimento */}
      {movModal && (
        <div className="cmd-backdrop" style={{ zIndex: 1000 }} onClick={() => setMovModal(null)}>
          <div className="card" style={{ width: "min(420px, 92vw)" }} onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h2>
                {movModal === "SANGRIA" ? "Registrar Sangria (Retirada)" : "Registrar Suprimento (Entrada)"}
              </h2>
              <button type="button" className="btn sm ghost" onClick={() => setMovModal(null)}>
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleCashMovement}>
              <div className="form-grid">
                <div className="field s12">
                  <label>Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={movAmount}
                    onChange={(e) => setMovAmount(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="field s12">
                  <label>Motivo / Observação *</label>
                  <input
                    value={movReason}
                    onChange={(e) => setMovReason(e.target.value)}
                    placeholder="Ex: Retirada p/ depósito ou Troco extra"
                    required
                  />
                </div>
              </div>
              <div className="form-actions mt">
                <button type="button" className="btn secondary" onClick={() => setMovModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn" disabled={isPending}>
                  Confirmar {movModal}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Fechar Caixa */}
      {closeModal && activeSession && (
        <div className="cmd-backdrop" style={{ zIndex: 1000 }} onClick={() => setCloseModal(false)}>
          <div className="card" style={{ width: "min(480px, 94vw)" }} onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h2>
                <Lock size={17} /> Fechamento de Caixa #{activeSession.id}
              </h2>
              <button type="button" className="btn sm ghost" onClick={() => setCloseModal(false)}>
                <X size={15} />
              </button>
            </div>
            <div className="mb" style={{ padding: 12, borderRadius: 8, background: "var(--surface-subtle)", fontSize: 13 }}>
              <div className="row between">
                <span>Fundo Inicial:</span>
                <strong>{brl(activeSession.openingBalance)}</strong>
              </div>
              <div className="row between">
                <span>(+) Vendas em Dinheiro:</span>
                <strong>{brl(activeSession.totalCash)}</strong>
              </div>
              <div className="row between">
                <span>(+) Suprimentos:</span>
                <strong>{brl(activeSession.supplies)}</strong>
              </div>
              <div className="row between">
                <span>(-) Sangrias:</span>
                <strong>-{brl(activeSession.withdrawals)}</strong>
              </div>
              <div className="row between" style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 6 }}>
                <span className="bold">Saldo Esperado em Dinheiro na Gaveta:</span>
                <strong style={{ fontSize: 15 }}>{brl(expectedCashInDrawer)}</strong>
              </div>
              <div className="row between small muted" style={{ marginTop: 6 }}>
                <span>PIX no turno: {brl(activeSession.totalPix)}</span>
                <span>Cartão no turno: {brl(activeSession.totalCard)}</span>
              </div>
            </div>
            <form onSubmit={handleCloseCash}>
              <div className="form-grid">
                <div className="field s12">
                  <label>Valor Físico Contado na Gaveta (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={closingInput}
                    onChange={(e) => setClosingInput(e.target.value)}
                    required
                  />
                </div>
                <div className="field s12">
                  <label>Observações do Fechamento</label>
                  <input
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    placeholder="Ex: Caixa bateu sem diferenças"
                  />
                </div>
              </div>
              <div className="form-actions mt">
                <button type="button" className="btn secondary" onClick={() => setCloseModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn danger" disabled={isPending}>
                  Encerrar Turno de Caixa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BarcodeScannerModal
        isOpen={scannerOpen}
        onScan={handleBarcodeDetected}
        onClose={() => setScannerOpen(false)}
      />
    </div>
  );
}
