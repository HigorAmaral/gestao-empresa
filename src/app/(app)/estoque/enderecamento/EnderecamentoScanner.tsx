"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";

export function EnderecamentoScanner() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleScan(code: string) {
    const clean = code.trim();
    // Se parecer um código de localização (ex: A-01-01 ou LOC)
    if (clean.includes("-") || clean.toUpperCase().startsWith("LOC")) {
      router.push(`/estoque/enderecamento?view=enderecos&q=${encodeURIComponent(clean)}`);
    } else {
      router.push(`/estoque/enderecamento?view=produtos&q=${encodeURIComponent(clean)}`);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn secondary"
        onClick={() => setOpen(true)}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
        title="Bipar etiqueta de produto ou endereço de estoque com a câmera"
      >
        <Camera size={15} /> Bipar com Câmera
      </button>

      <BarcodeScannerModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onScan={handleScan}
        title="Bipar Produto ou Endereço de Estoque"
        instruction="Aponte para o código de barras ou QR code da prateleira (ex: A-01-01) ou do produto."
      />
    </>
  );
}
