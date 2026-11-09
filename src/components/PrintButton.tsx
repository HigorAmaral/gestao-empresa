"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Imprimir / PDF" }: { label?: string }) {
  return (
    <button type="button" className="btn secondary no-print" onClick={() => window.print()}>
      <Printer size={15} /> {label}
    </button>
  );
}
