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
      } else if (e.key === "F4") {
        e.preventDefault();
        if (cart.length > 0 && !isPending) {
          handleCheckout();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cart, isPending]);

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
      <div className="card mb" style={{ padding: 0, overflow: "hidden" }}>
        <div className="pdv-shift-bar">
          <div className="pdv-shift-metrics">
            {activeSession ? (
              <>
                <span className="badge success" style={{ fontSize: 12.5, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                  <Unlock size={14} /> CAIXA #{activeSession.id} ABERTO ({activeSession.userName})
                </span>
                <div className="pdv-metric-chip">
                  <span className="muted">Fundo Inicial:</span> <strong>{brl(activeSession.openingBalance)}</strong>
                </div>
                <div className="pdv-metric-chip">
                  <span className="muted">Vendas no Turno ({activeSession.salesCount}):</span>{" "}
                  <strong>{brl(totalSessionSales)}</strong>
                </div>
                <div className="pdv-metric-chip">
                  <span className="muted">Gaveta:</span>{" "}
                  <strong style={{ color: "#10b981" }}>{brl(expectedCashInDrawer)}</strong>
                </div>
              </>
            ) : (
              <span className="badge warning" style={{ fontSize: 13, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Lock size={14} /> CAIXA FECHADO (Você pode abrir o turno para controle de gaveta ou vender direto)
              </span>
            )}
          </div>

          <div className="pdv-shift-actions">
            {!activeSession ? (
              <button type="button" className="pdv-btn-shift primary" onClick={() => setOpenModal(true)}>
                <Unlock size={14} /> Abrir Turno de Caixa
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="pdv-btn-shift"
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
                  className="pdv-btn-shift"
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
                  className="pdv-btn-shift danger"
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
        <div className={`alert ${feedback.type === "ok" ? "success" : "error"} mb row between`} style={{ flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
            {feedback.type === "ok" && <CheckCircle2 size={16} className="icon-inline" />} {feedback.text}
          </span>
          {feedback.saleId && (
            <div className="row" style={{ gap: 8 }}>
              <Link className="btn sm" href={`/vendas/${feedback.saleId}/recibo`} style={{ height: 32, padding: "0 12px", fontSize: 12.5 }}>
                <Printer size={14} /> Imprimir Cupom / Recibo
              </Link>
              <Link className="btn sm secondary" href={`/vendas/${feedback.saleId}`} style={{ height: 32, padding: "0 12px", fontSize: 12.5 }}>
                Ver Venda #{feedback.saleId}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Layout Principal do PDV: Catálogo à Esquerda + Carrinho/Caixa à Direita */}
      <div className="grid grid-2" style={{ gridTemplateColumns: "1.35fr 1fr", alignItems: "start", gap: 16 }}>
        {/* Coluna Esquerda: Busca por Código de Barras + Produtos */}
        <div className="card">
          <div className="pdv-search-bar">
            <div className="pdv-search-input">
              <Search size={16} className="pdv-search-icon" />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Bipe o código de barras (SKU) ou busque pelo nome... [F2]"
                autoFocus
              />
            </div>
            <button
              type="button"
              className="pdv-btn-scan"
              onClick={() => setScannerOpen(true)}
              title="Ler Código de Barras pela Câmera"
            >
              <Camera size={16} /> Ler Código
            </button>
          </div>

          {categories.length > 0 && (
            <div className="pdv-category-list">
              <button
                type="button"
                className={`pdv-cat-pill ${categoryFilter === "" ? "active" : ""}`}
                onClick={() => setCategoryFilter("")}
              >
                Todos ({products.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`pdv-cat-pill ${categoryFilter === cat ? "active" : ""}`}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          <div className="pdv-product-grid">
            {filteredProducts.map((p) => {
              const outOfStock = p.stock <= 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={outOfStock}
                  onClick={() => addToCart(p)}
                  className="pdv-product-card"
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                      <span className="pdv-card-sku">{p.sku}</span>
                      <span className={`badge ${outOfStock ? "danger" : "neutral"}`} style={{ fontSize: 10, padding: "2px 6px" }}>
                        {outOfStock ? "Esgotado" : `${p.stock} ${p.unit}`}
                      </span>
                    </div>
                    <div className="pdv-card-name" title={p.name}>
                      {p.name}
                    </div>
                  </div>
                  <div className="pdv-card-bottom">
                    <span className="pdv-card-price">{brl(p.salePrice)}</span>
                    <span className="small muted" style={{ fontSize: 11, fontWeight: 600 }}>+ Adicionar</span>
                  </div>
                </button>
              );
            })}
            {filteredProducts.length === 0 && (
              <div className="empty" style={{ gridColumn: "1 / -1", padding: "40px 16px" }}>
                Nenhum produto encontrado para &ldquo;{search}&rdquo;.
              </div>
            )}
          </div>
        </div>

        {/* Coluna Direita: Cupom / Carrinho e Fechamento */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <ShoppingCart size={17} /> Cupom de Venda
              <span className="badge neutral" style={{ fontSize: 11, fontWeight: 700 }}>
                {cart.reduce((s, i) => s + i.quantity, 0)} {cart.reduce((s, i) => s + i.quantity, 0) === 1 ? "item" : "itens"}
              </span>
            </h2>
            {cart.length > 0 && (
              <button
                type="button"
                className="btn sm secondary"
                style={{ height: 28, padding: "0 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                onClick={() => setCart([])}
              >
                <Trash2 size={13} /> Limpar
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="empty" style={{ padding: "44px 16px" }}>
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
                        <div className="pdv-qty-stepper" style={{ justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="pdv-btn-qty"
                            onClick={() => updateQty(item.product.id, item.quantity - 1)}
                            title="Diminuir quantidade"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="pdv-qty-num">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            className="pdv-btn-qty"
                            onClick={() => updateQty(item.product.id, item.quantity + 1)}
                            title="Aumentar quantidade"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="num bold" style={{ fontSize: 13.5 }}>{brl(item.quantity * item.unitPrice)}</td>
                      <td className="num">
                        <button
                          type="button"
                          className="pdv-btn-del"
                          onClick={() => updateQty(item.product.id, 0)}
                          title="Remover produto"
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
                <label style={{ margin: 0, fontWeight: 600 }}>Forma de Pagamento</label>
                <label className="checkbox small" style={{ fontWeight: 500, cursor: "pointer" }}>
                  <input type="checkbox" checked={useSplit} onChange={(e) => setUseSplit(e.target.checked)} />
                  <Split size={13} /> Dividir em 2 pagamentos
                </label>
              </div>

              {!useSplit ? (
                <div className="pdv-payment-grid">
                  {[
                    { id: "PIX", label: "PIX", Icon: QrCode },
                    { id: "Dinheiro", label: "Dinheiro", Icon: Banknote },
                    { id: "Cartão de Crédito", label: "Crédito", Icon: CreditCard },
                    { id: "Cartão de Débito", label: "Débito", Icon: CreditCard },
                  ].map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      className={`pdv-payment-btn ${paymentMethod === id ? "active" : ""}`}
                      onClick={() => setPaymentMethod(id)}
                    >
                      <Icon size={15} /> {label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="form-grid" style={{ padding: 12, borderRadius: 8, background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
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
                  style={{
                    padding: "12px 14px",
                    borderRadius: 8,
                    background: "var(--surface-subtle)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="row between" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <label className="small muted" style={{ display: "block", marginBottom: 4 }}>
                        Valor Recebido em Espécie (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Ex: 50,00"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        style={{ height: 38, fontSize: 15, fontWeight: 700 }}
                      />
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="small muted" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em" }}>TROCO A DEVOLVER</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: changeAmount > 0 ? "#10b981" : "var(--text)", marginTop: 2 }}>
                        {brl(changeAmount)}
                      </div>
                    </div>
                  </div>

                  <div className="pdv-cash-presets">
                    <span className="small muted bold" style={{ marginRight: 2 }}>Atalhos:</span>
                    <button
                      type="button"
                      className="pdv-btn-preset"
                      onClick={() => setCashReceived(total.toFixed(2))}
                    >
                      Exato ({brl(total)})
                    </button>
                    {[20, 50, 100, 200].map((v) => (
                      <button
                        key={v}
                        type="button"
                        className="pdv-btn-preset"
                        onClick={() => setCashReceived(String(v))}
                      >
                        R$ {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Resumo Total e Botão Finalizar */}
          <div
            style={{
              marginTop: 16,
              padding: "16px 18px",
              borderRadius: 10,
              background: "#09090b",
              border: "1px solid #27272a",
              color: "#ffffff",
            }}
          >
            <div className="row between small" style={{ color: "#a1a1aa", marginBottom: 6 }}>
              <span>Subtotal: {brl(subtotal)}</span>
              {discountVal > 0 && <span style={{ color: "#ef4444" }}>Desconto: -{brl(discountVal)}</span>}
            </div>
            <div className="row between" style={{ alignItems: "baseline" }}>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.05em", color: "#a1a1aa" }}>TOTAL A PAGAR</span>
              <span style={{ fontSize: 28, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.5px" }}>{brl(total)}</span>
            </div>
          </div>

          <button
            type="button"
            className="pdv-btn-checkout"
            disabled={cart.length === 0 || isPending}
            onClick={handleCheckout}
          >
            <CheckCircle2 size={18} />
            {isPending ? "Processando Venda..." : "Finalizar Venda Rápida (F4)"}
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
              <div className="form-actions mt" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ height: 38, padding: "0 18px", fontSize: 13.5 }}
                  onClick={() => setOpenModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn"
                  style={{ height: 38, padding: "0 20px", fontSize: 13.5, fontWeight: 700 }}
                  disabled={isPending}
                >
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
              <div className="form-actions mt" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ height: 38, padding: "0 18px", fontSize: 13.5 }}
                  onClick={() => setMovModal(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn"
                  style={{ height: 38, padding: "0 20px", fontSize: 13.5, fontWeight: 700 }}
                  disabled={isPending}
                >
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
              <div className="form-actions mt" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ height: 38, padding: "0 18px", fontSize: 13.5 }}
                  onClick={() => setCloseModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn danger"
                  style={{ height: 38, padding: "0 20px", fontSize: 13.5, fontWeight: 700 }}
                  disabled={isPending}
                >
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
