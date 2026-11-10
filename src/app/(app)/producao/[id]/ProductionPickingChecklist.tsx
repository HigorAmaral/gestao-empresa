"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  MapPin,
  Printer,
  Sparkles,
  Tag,
} from "lucide-react";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";
import { num } from "@/lib/format";

export type PickingItem = {
  id: number;
  productId: number;
  quantityRequired: number;
  notes?: string | null;
  product: {
    id: number;
    name: string;
    sku?: string | null;
    unit: string;
    stock: number;
  };
  location?: {
    id: number;
    code: string;
    aisle?: string | null;
    rack?: string | null;
    shelf?: string | null;
    bin?: string | null;
  } | null;
};

export function ProductionPickingChecklist({
  orderId,
  machine,
  items,
}: {
  orderId: number;
  machine: string;
  items: PickingItem[];
}) {
  const [checkedIds, setCheckedIds] = useState<Record<number, boolean>>({});
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const totalItems = items.length;
  const checkedCount = Object.values(checkedIds).filter(Boolean).length;
  const isAllChecked = totalItems > 0 && checkedCount === totalItems;

  function toggleCheck(id: number) {
    setCheckedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleBarcodeScanned(code: string) {
    const clean = code.trim().toLowerCase();
    // Procura por SKU do produto ou código da localização
    const match = items.find(
      (item) =>
        (item.product.sku && item.product.sku.toLowerCase() === clean) ||
        item.product.name.toLowerCase() === clean ||
        String(item.product.id) === clean ||
        (item.location && item.location.code.toLowerCase() === clean)
    );

    if (match) {
      setCheckedIds((prev) => ({ ...prev, [match.id]: true }));
      setScanMessage(
        `✓ Insumo conferido com sucesso: "${match.product.name}"${
          match.location ? ` (Endereço: ${match.location.code})` : ""
        }`
      );
    } else {
      setScanMessage(`Código "${code}" não pertence a nenhum insumo ou endereço desta OP.`);
    }
  }

  return (
    <div className="card table-responsive">
      <div
        style={{
          padding: "4px 0 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
              Lista de Insumos & Separação para Entrega na Máquina (BOM)
            </h3>
            {isAllChecked && (
              <span className="badge green" style={{ fontSize: 12 }}>
                <CheckCircle2 size={13} style={{ marginRight: 3 }} /> Todos Insumos Separados
              </span>
            )}
          </div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "3px 0 0" }}>
            Progresso da separação no almoxarifado: <strong>{checkedCount} de {totalItems} insumos conferidos</strong> para envio à máquina <strong>{machine}</strong>.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn secondary"
            onClick={() => setScannerOpen(true)}
            style={{ fontSize: 12.5 }}
            title="Bipar etiquetas de endereço ou produto com a câmera"
          >
            <Camera size={14} /> Bipar / Conferir
          </button>
          <Link className="btn secondary" href={`/producao/${orderId}/recibo`} style={{ fontSize: 12.5 }}>
            <Printer size={14} /> Ficha de Separação
          </Link>
          <Link className="btn secondary" href={`/producao/${orderId}/etiquetas`} style={{ fontSize: 12.5 }}>
            <Tag size={14} /> Etiquetas do Lote
          </Link>
        </div>
      </div>

      {scanMessage && (
        <div
          style={{
            padding: "8px 12px",
            background: scanMessage.startsWith("✓") ? "#ecfdf5" : "#fef2f2",
            color: scanMessage.startsWith("✓") ? "#047857" : "#b91c1c",
            borderRadius: 6,
            marginBottom: 12,
            fontSize: 12.5,
            fontWeight: 500,
          }}
        >
          {scanMessage}
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th style={{ width: 44, textAlign: "center" }}>Check</th>
            <th>Matéria-Prima / Insumo</th>
            <th style={{ textAlign: "right" }}>Qtd Necessária</th>
            <th>Endereço para Retirada no Estoque</th>
            <th>Instrução do Insumo</th>
            <th>Disponibilidade no Estoque</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isChecked = !!checkedIds[item.id];
            const isSufficient = item.product.stock >= item.quantityRequired;

            return (
              <tr
                key={item.id}
                style={{
                  background: isChecked ? "rgba(34, 197, 94, 0.05)" : undefined,
                  transition: "background 0.2s ease",
                }}
              >
                <td style={{ textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleCheck(item.id)}
                    style={{ cursor: "pointer", width: 17, height: 17 }}
                    title={isChecked ? "Insumo conferido" : "Marcar como separado"}
                  />
                </td>
                <td>
                  <div
                    style={{
                      fontWeight: 600,
                      textDecoration: isChecked ? "line-through" : "none",
                      color: isChecked ? "var(--muted)" : "inherit",
                    }}
                  >
                    {item.product.name}
                  </div>
                  {item.product.sku && (
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>SKU: {item.product.sku}</div>
                  )}
                </td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>
                  {num(item.quantityRequired)} {item.product.unit}
                </td>
                <td>
                  {item.location ? (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span className="badge blue" style={{ fontWeight: 600 }}>
                        <MapPin size={11} style={{ marginRight: 3 }} />
                        {item.location.code}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        {[item.location.aisle, item.location.rack, item.location.shelf, item.location.bin]
                          .filter(Boolean)
                          .join(" / ")}
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>Área geral (sem endereço)</span>
                  )}
                </td>
                <td>
                  {item.notes ? (
                    <span style={{ fontSize: 12.5 }}>{item.notes}</span>
                  ) : (
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                  )}
                </td>
                <td>
                  {isSufficient ? (
                    <span className="badge green" style={{ fontSize: 11 }}>
                      <CheckCircle2 size={11} style={{ marginRight: 3 }} /> Saldo: {item.product.stock} {item.product.unit}
                    </span>
                  ) : (
                    <span className="badge red" style={{ fontSize: 11 }} title="Estoque insuficiente">
                      <AlertTriangle size={11} style={{ marginRight: 3 }} /> Saldo: {item.product.stock} (Falta{" "}
                      {num(item.quantityRequired - item.product.stock)})
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Leitor de código de barras para bipagem rápida na separação */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title="Bipar Insumo / Endereço na Separação"
        instruction="Aponte para o código de barras do material ou para a etiqueta do endereço na prateleira para confirmar a retirada."
      />
    </div>
  );
}
