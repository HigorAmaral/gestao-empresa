import Link from "next/link";
import type { Prisma } from "@prisma/client";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRightLeft,
  Boxes,
  CheckCircle2,
  FolderPlus,
  Layers,
  MapPin,
  Plus,
  Search,
  Tag,
  Trash2,
  Warehouse,
  Wrench,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { pageParams, spStr } from "@/lib/form";
import { num } from "@/lib/format";
import { ExportCsvButton, FlashMessages, PageHeader, Pagination } from "@/components/ui";
import { ActionForm, ConfirmButton } from "@/components/Forms";
import { ensureStockLocationTables } from "@/lib/stock-location";
import { EnderecamentoScanner } from "./EnderecamentoScanner";
import {
  assignProductLocation,
  batchCreateLocations,
  deleteLocation,
  deleteProductLocation,
  saveLocation,
  transferProductLocation,
} from "./actions";

type SP = Promise<Record<string, string | string[] | undefined>>;

type ProductWithLocations = Prisma.ProductGetPayload<{
  include: {
    stockLocations: {
      include: { location: true };
    };
  };
}>;

type LocationWithItems = Prisma.StockLocationGetPayload<{
  include: {
    items: {
      include: { product: true };
    };
  };
}>;

export default async function EnderecamentoPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const view = spStr(sp, "view") || "produtos"; // "produtos" | "enderecos"
  const q = spStr(sp, "q");
  const filter = spStr(sp, "filter"); // "pendentes" | "enderecados" | "ocupados" | "livres"
  const selectedProductId = Number(spStr(sp, "productId")) || undefined;
  const selectedLocationId = Number(spStr(sp, "locationId")) || undefined;
  const op = spStr(sp, "op"); // "novo_endereco" | "lote" | "transferir" | null
  const { page, skip, take, pageSize } = pageParams(sp);

  // Garante que as tabelas de endereçamento existam no banco
  await ensureStockLocationTables();

  // Busca lista de produtos ativos e endereços ativos para os formulários
  let allProducts: ProductWithLocations[] = [];
  let allLocations: LocationWithItems[] = [];
  let dbError: string | null = null;

  try {
    const [prods, locs] = await Promise.all([
      prisma.product.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        include: {
          stockLocations: {
            include: { location: true },
          },
        },
      }),
      prisma.stockLocation.findMany({
        where: { active: true },
        orderBy: { code: "asc" },
        include: {
          items: {
            include: { product: true },
          },
        },
      }),
    ]);
    allProducts = prods;
    allLocations = locs;
  } catch (err: unknown) {
    console.error("Falha ao carregar dados de endereçamento:", err);
    dbError = "Sincronizando tabelas de endereçamento no banco de dados. Se persistir, recarregue a página.";
    allProducts = [];
    allLocations = [];
  }

  // KPIs
  const totalLocations = allLocations.length;
  const occupiedLocations = allLocations.filter((l) => l.items.length > 0).length;
  const freeLocations = totalLocations - occupiedLocations;
  const totalAllocatedItems = allLocations.reduce(
    (acc, l) => acc + l.items.reduce((s, it) => s + it.quantity, 0),
    0
  );

  // Produtos com saldo pendente de endereçamento
  const productsWithPending = allProducts.filter((p) => {
    const allocated = p.stockLocations.reduce((s, l) => s + l.quantity, 0);
    return p.stock > allocated;
  });

  // Query específica da aba ativa
  let productsList: ProductWithLocations[] = [];
  let productsTotal = 0;
  let locationsList: LocationWithItems[] = [];
  let locationsTotal = 0;

  try {
    if (view === "produtos") {
      const prodWhere: Prisma.ProductWhereInput = {
        active: true,
        ...(q && {
          OR: [
            { name: { contains: q } },
            { sku: { contains: q } },
            { category: { contains: q } },
          ],
        }),
        ...(selectedProductId && { id: selectedProductId }),
      };

      const fetched = await prisma.product.findMany({
        where: prodWhere,
        orderBy: { name: "asc" },
        include: {
          stockLocations: {
            include: { location: true },
            orderBy: { location: { code: "asc" } },
          },
        },
      });

      let filtered = fetched;
      if (filter === "pendentes") {
        filtered = fetched.filter((p) => {
          const allocated = p.stockLocations.reduce((s, l) => s + l.quantity, 0);
          return p.stock > allocated;
        });
      } else if (filter === "enderecados") {
        filtered = fetched.filter((p) => p.stockLocations.length > 0);
      } else if (filter === "sem_estoque") {
        filtered = fetched.filter((p) => p.stock <= 0);
      }

      productsTotal = filtered.length;
      productsList = filtered.slice(skip, skip + take);
    } else {
      // view === "enderecos"
      const locWhere: Prisma.StockLocationWhereInput = {
        active: true,
        ...(q && {
          OR: [
            { code: { contains: q } },
            { aisle: { contains: q } },
            { rack: { contains: q } },
            { description: { contains: q } },
          ],
        }),
        ...(selectedLocationId && { id: selectedLocationId }),
      };

      const fetched = await prisma.stockLocation.findMany({
        where: locWhere,
        orderBy: { code: "asc" },
        include: {
          items: {
            include: { product: true },
            orderBy: { product: { name: "asc" } },
          },
        },
      });

      let filtered = fetched;
      if (filter === "ocupados") {
        filtered = fetched.filter((l) => l.items.length > 0);
      } else if (filter === "livres") {
        filtered = fetched.filter((l) => l.items.length === 0);
      }

      locationsTotal = filtered.length;
      locationsList = filtered.slice(skip, skip + take);
    }
  } catch (err) {
    console.error("Erro na busca de dados de endereçamento:", err);
    productsList = allProducts.slice(skip, skip + take);
    productsTotal = allProducts.length;
    locationsList = allLocations.slice(skip, skip + take);
    locationsTotal = allLocations.length;
  }

  return (
    <>
      <PageHeader
        title="Endereçamento de Estoque"
        subtitle="Localização física de produtos, controle de ruas, prateleiras, gavetas e saldos por endereço"
        actions={
          <>
            <Link className="btn secondary" href="/estoque">
              <ArrowLeft size={15} /> Voltar ao Estoque
            </Link>
            <EnderecamentoScanner />
            <Link className="btn secondary" href="/estoque/enderecamento/etiquetas">
              <Tag size={15} /> Imprimir Etiquetas
            </Link>
            <ExportCsvButton entity="enderecamento" label="Exportar CSV" />
          </>
        }
      />
      <FlashMessages sp={sp} />
      {dbError && (
        <div className="alert error" style={{ marginBottom: 16 }}>
          <AlertCircle size={17} /> {dbError}
        </div>
      )}

      {/* Subnavegação entre Estoque Geral e Endereçamento */}
      <div className="subnav-tabs">
        <Link className="subnav-tab" href="/estoque">
          <Layers size={14} /> Movimentações & Saldo
        </Link>
        <Link className="subnav-tab active" href="/estoque/enderecamento">
          <MapPin size={14} /> Endereçamento & Localização
        </Link>
      </div>

      {/* Painel de Indicadores */}
      <div className="stats">
        <div className="stat">
          <div className="label">Endereços Cadastrados</div>
          <div className="value">{num(totalLocations, 0)}</div>
          <div className="hint">
            {num(occupiedLocations, 0)} ocupados ({totalLocations ? Math.round((occupiedLocations / totalLocations) * 100) : 0}%)
          </div>
        </div>
        <div className="stat primary">
          <div className="label">Endereços Livres</div>
          <div className="value">{num(freeLocations, 0)}</div>
          <div className="hint">Prontos para novos produtos</div>
        </div>
        <div className="stat success">
          <div className="label">Itens Endereçados</div>
          <div className="value">{num(totalAllocatedItems)}</div>
          <div className="hint">Unidades alocadas fisicamente</div>
        </div>
        <div className={`stat ${productsWithPending.length ? "warning" : ""}`}>
          <div className="label">Pendentes de Alocação</div>
          <div className="value">{productsWithPending.length}</div>
          <div className="hint">
            {productsWithPending.length > 0 ? (
              <Link href="/estoque/enderecamento?view=produtos&filter=pendentes">ver pendentes</Link>
            ) : (
              "100% dos produtos endereçados"
            )}
          </div>
        </div>
      </div>

      {/* Seção de Ações / Formulários em Grade */}
      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        {/* Formulário: Endereçar Produto (Alocar Produto no Endereço) */}
        <div className="card">
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>
              <MapPin size={16} /> Endereçar Produto
            </h2>
            <span className="muted small">Armazenar produto num local</span>
          </div>
          <ActionForm action={assignProductLocation} submitLabel="Salvar Endereçamento" resetOnSuccess>
            <div className="form-grid">
              <div className="field s12">
                <label>Produto *</label>
                <select name="productId" required defaultValue={selectedProductId ?? ""}>
                  <option value="" disabled>
                    Selecione o produto...
                  </option>
                  {allProducts.map((p) => {
                    const allocated = p.stockLocations.reduce((s, l) => s + l.quantity, 0);
                    const pending = p.stock - allocated;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.sku} — {p.name} (Saldo: {num(p.stock)} {p.unit} | Endereçado: {num(allocated)} | Pendente: {num(pending)})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="field s8">
                <label>Endereço de Estoque *</label>
                <select name="locationId" required defaultValue={selectedLocationId ?? ""}>
                  <option value="" disabled>
                    Selecione o endereço...
                  </option>
                  {allLocations.map((l) => {
                    const desc = [l.aisle, l.rack, l.shelf, l.bin].filter(Boolean).join(" • ");
                    return (
                      <option key={l.id} value={l.id}>
                        {l.code} {desc ? `(${desc})` : ""} — {l.items.length} produto(s)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="field s4">
                <label>Quantidade *</label>
                <input
                  name="quantity"
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="Ex.: 10"
                  required
                />
              </div>

              <div className="field s12">
                <label>Observação / Identificador Adicional</label>
                <input name="notes" placeholder="Ex.: Caixa 02, Lote 2026-A, Palete no chão..." />
              </div>
            </div>
          </ActionForm>
        </div>

        {/* Formulário: Transferência entre Endereços ou Cadastro Rápido */}
        <div className="card">
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>
              {op === "lote" ? (
                <>
                  <Boxes size={16} /> Gerador de Endereços em Lote
                </>
              ) : op === "novo_endereco" ? (
                <>
                  <Plus size={16} /> Novo Endereço de Estoque
                </>
              ) : (
                <>
                  <ArrowRightLeft size={16} /> Transferir entre Endereços
                </>
              )}
            </h2>
            <div style={{ display: "flex", gap: 6 }}>
              {op !== null && (
                <Link className="btn sm secondary" href="/estoque/enderecamento">
                  Transferir
                </Link>
              )}
              {op !== "novo_endereco" && (
                <Link className="btn sm secondary" href="/estoque/enderecamento?op=novo_endereco">
                  + Endereço
                </Link>
              )}
              {op !== "lote" && (
                <Link className="btn sm secondary" href="/estoque/enderecamento?op=lote">
                  Em Lote
                </Link>
              )}
            </div>
          </div>

          {op === "lote" ? (
            <ActionForm action={batchCreateLocations} submitLabel="Gerar Endereços em Lote" resetOnSuccess>
              <div className="form-grid">
                <div className="field s6">
                  <label>Identificador do Corredor/Rua *</label>
                  <input name="aislePrefix" placeholder="Ex.: A, B, RUA1, PALETE" required />
                </div>
                <div className="field s6">
                  <label>Qtd. de Estantes / Módulos *</label>
                  <input name="racksCount" type="number" min="1" max="20" defaultValue="3" required />
                </div>
                <div className="field s6">
                  <label>Níveis / Andares por Estante *</label>
                  <input name="shelvesCount" type="number" min="1" max="10" defaultValue="4" required />
                </div>
                <div className="field s6">
                  <label>Posições / Gavetas por Nível</label>
                  <input name="binsCount" type="number" min="1" max="10" defaultValue="1" />
                </div>
                <div className="field s12">
                  <p className="muted small" style={{ margin: 0 }}>
                    Exemplo gerado: <code>A-01-01</code>, <code>A-01-02</code>, <code>A-02-01</code>...
                  </p>
                </div>
              </div>
            </ActionForm>
          ) : op === "novo_endereco" ? (
            <ActionForm action={saveLocation.bind(null, null)} submitLabel="Criar Endereço" resetOnSuccess>
              <div className="form-grid">
                <div className="field s6">
                  <label>Código do Endereço *</label>
                  <input name="code" placeholder="Ex.: A-01-02-01 ou RUA-A-01" required />
                </div>
                <div className="field s6">
                  <label>Corredor / Rua / Galpão</label>
                  <input name="aisle" placeholder="Ex.: Corredor A, Galpão 1" />
                </div>
                <div className="field s4">
                  <label>Estante / Módulo</label>
                  <input name="rack" placeholder="Ex.: Estante 01" />
                </div>
                <div className="field s4">
                  <label>Nível / Andar</label>
                  <input name="shelf" placeholder="Ex.: Nível 02" />
                </div>
                <div className="field s4">
                  <label>Vão / Gaveta</label>
                  <input name="bin" placeholder="Ex.: Gaveta 03" />
                </div>
                <div className="field s12">
                  <label>Descrição / Observação</label>
                  <input name="description" placeholder="Ex.: Prateleira de baixo, peças pesadas..." />
                </div>
              </div>
            </ActionForm>
          ) : (
            <ActionForm action={transferProductLocation} submitLabel="Transferir Produto" resetOnSuccess>
              <div className="form-grid">
                <div className="field s12">
                  <label>Produto *</label>
                  <select name="productId" required defaultValue="">
                    <option value="" disabled>
                      Selecione o produto a mover...
                    </option>
                    {allProducts
                      .filter((p) => p.stockLocations.length > 0)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} — {p.name} ({p.stockLocations.length} endereço(s))
                        </option>
                      ))}
                  </select>
                </div>
                <div className="field s6">
                  <label>De (Origem) *</label>
                  <select name="fromLocationId" required defaultValue="">
                    <option value="" disabled>
                      Endereço de origem...
                    </option>
                    {allLocations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field s6">
                  <label>Para (Destino) *</label>
                  <select name="toLocationId" required defaultValue="">
                    <option value="" disabled>
                      Endereço de destino...
                    </option>
                    {allLocations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field s12">
                  <label>Quantidade a Mover *</label>
                  <input name="quantity" type="number" step="0.001" min="0.001" placeholder="Ex.: 5" required />
                </div>
              </div>
            </ActionForm>
          )}
        </div>
      </div>

      {/* Navegação de Visualizações: Por Produto vs Por Endereço */}
      <div className="card flush">
        <div
          className="card-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0 }}>Consulta e Localização</h2>
            <div className="period-tabs">
              <Link
                className={`period-tab ${view === "produtos" ? "active" : ""}`}
                href={`/estoque/enderecamento?view=produtos${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              >
                Localizar por Produto ({allProducts.length})
              </Link>
              <Link
                className={`period-tab ${view === "enderecos" ? "active" : ""}`}
                href={`/estoque/enderecamento?view=enderecos${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              >
                Mapa de Endereços ({allLocations.length})
              </Link>
            </div>
          </div>
        </div>

        {/* Filtros de Busca */}
        <form className="filters" style={{ padding: "14px 20px 0" }}>
          <input type="hidden" name="view" value={view} />
          <input
            className="grow"
            name="q"
            placeholder={
              view === "produtos"
                ? "Buscar produto por nome, código SKU ou categoria..."
                : "Buscar endereço por código, corredor ou estante..."
            }
            defaultValue={q}
          />
          {view === "produtos" ? (
            <select name="filter" defaultValue={filter}>
              <option value="">Todos os status</option>
              <option value="pendentes">Pendentes de Alocação</option>
              <option value="enderecados">Já Endereçados</option>
              <option value="sem_estoque">Sem Estoque</option>
            </select>
          ) : (
            <select name="filter" defaultValue={filter}>
              <option value="">Todos os endereços</option>
              <option value="ocupados">Apenas Ocupados</option>
              <option value="livres">Apenas Livres (Vazios)</option>
            </select>
          )}
          <button className="btn secondary">
            <Search size={14} /> Filtrar
          </button>
        </form>

        {/* Tabela de Produtos com seus Endereços e Quantidades */}
        {view === "produtos" ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Produto</th>
                  <th className="num">Saldo Total</th>
                  <th className="num">Endereçado</th>
                  <th className="num">Pendente</th>
                  <th>Onde está guardado (Endereços & Quantidades)</th>
                  <th style={{ width: 110, textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {productsList.map((p) => {
                  const allocated = p.stockLocations.reduce((s, l) => s + l.quantity, 0);
                  const pending = p.stock - allocated;
                  const isFullyAllocated = p.stock > 0 && pending <= 0;
                  const hasPending = pending > 0;

                  return (
                    <tr key={p.id}>
                      <td style={{ fontFamily: "monospace", fontWeight: 700 }}>
                        <Link href={`/produtos/${p.id}`}>{p.sku}</Link>
                      </td>
                      <td>
                        <Link href={`/produtos/${p.id}`} className="bold">
                          {p.name}
                        </Link>
                        {p.category && <div className="muted small">{p.category}</div>}
                      </td>
                      <td className="num bold">
                        {num(p.stock)} {p.unit}
                      </td>
                      <td className="num">
                        {num(allocated)} {p.unit}
                      </td>
                      <td className="num">
                        {hasPending ? (
                          <span className="badge yellow" title="Quantidade física pendente de alocação em endereço">
                            {num(pending)} {p.unit}
                          </span>
                        ) : isFullyAllocated ? (
                          <span className="badge green">100% OK</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        {p.stockLocations.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {p.stockLocations.map((item) => (
                              <div key={item.id} className="location-tag">
                                <MapPin size={12} className="muted" />
                                <span>{item.location.code}</span>
                                <span className="location-tag-qty">
                                  {num(item.quantity)} {p.unit}
                                </span>
                                {item.notes && (
                                  <span className="muted small" title={item.notes} style={{ fontStyle: "italic" }}>
                                    ({item.notes})
                                  </span>
                                )}
                                <ConfirmButton
                                  action={deleteProductLocation.bind(null, item.id)}
                                  label="×"
                                  confirmText={`Desalocar ${item.quantity} ${p.unit} de ${p.name} do endereço ${item.location.code}?`}
                                  className="btn sm secondary"
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="muted small" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <AlertCircle size={13} className="text-danger" /> Nenhum endereço vinculado
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link
                          className="btn sm secondary"
                          href={`/estoque/enderecamento?productId=${p.id}&view=produtos`}
                          title="Endereçar este produto"
                        >
                          <MapPin size={12} /> Endereçar
                        </Link>
                      </td>
                    </tr>
                  );
                })}

                {productsList.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty">
                      Nenhum produto encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Tabela do Mapa de Endereços com Produtos e Quantidades Armazenadas */
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código do Endereço</th>
                  <th>Localização (Corredor / Estante / Nível / Vão)</th>
                  <th>Status</th>
                  <th>Produtos Armazenados & Quantidades</th>
                  <th>Observações</th>
                  <th style={{ width: 110, textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {locationsList.map((loc) => {
                  const isOccupied = loc.items.length > 0;
                  const totalUnits = loc.items.reduce((s, it) => s + it.quantity, 0);

                  return (
                    <tr key={loc.id}>
                      <td>
                        <span className="location-tag highlight">{loc.code}</span>
                      </td>
                      <td>
                        {[loc.aisle, loc.rack, loc.shelf, loc.bin].filter(Boolean).join(" • ") || "—"}
                      </td>
                      <td>
                        {isOccupied ? (
                          <span className="badge blue">
                            {loc.items.length} produto(s) ({num(totalUnits)} un)
                          </span>
                        ) : (
                          <span className="badge gray">Livre</span>
                        )}
                      </td>
                      <td>
                        {loc.items.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {loc.items.map((it) => (
                              <div
                                key={it.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 8,
                                  fontSize: 12.5,
                                }}
                              >
                                <span>
                                  <Link href={`/produtos/${it.productId}`} className="bold">
                                    {it.product.name}
                                  </Link>{" "}
                                  <span className="muted">({it.product.sku})</span>
                                </span>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                  <span className="bold">
                                    {num(it.quantity)} {it.product.unit}
                                  </span>
                                  <ConfirmButton
                                    action={deleteProductLocation.bind(null, it.id)}
                                    label="×"
                                    confirmText={`Remover ${it.product.name} do endereço ${loc.code}?`}
                                    className="btn sm secondary"
                                  />
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="muted small">Espaço livre disponível</span>
                        )}
                      </td>
                      <td className="muted small">{loc.description || "—"}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: 4 }}>
                          <Link
                            className="btn sm secondary"
                            href={`/estoque/enderecamento?locationId=${loc.id}&view=enderecos`}
                            title="Alocar produto aqui"
                          >
                            <Plus size={12} /> Alocar
                          </Link>
                          {!isOccupied && (
                            <ConfirmButton
                              action={deleteLocation.bind(null, loc.id)}
                              label="Excluir"
                              confirmText={`Deseja excluir o endereço ${loc.code}?`}
                              className="btn sm secondary"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {locationsList.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">
                      Nenhum endereço encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          basePath="/estoque/enderecamento"
          sp={sp}
          page={page}
          pageSize={pageSize}
          total={view === "produtos" ? productsTotal : locationsTotal}
        />
      </div>
    </>
  );
}
