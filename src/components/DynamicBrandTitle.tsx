"use client";

import { useEffect } from "react";

/**
 * Atualiza o document.title dinamicamente no navegador substituindo "GestãoPro"
 * pelo Nome Fantasia da empresa configurado no banco.
 */
export function DynamicBrandTitle({ brandName }: { brandName: string }) {
  useEffect(() => {
    if (!brandName) return;
    const updateTitle = () => {
      const current = document.title;
      if (current.includes("GestãoPro")) {
        document.title = current.replace(/GestãoPro/g, brandName);
      } else if (!current.includes(brandName)) {
        if (current.includes("— Sistema de Gerenciamento")) {
          document.title = `${brandName} — Sistema de Gerenciamento Empresarial`;
        }
      }
    };

    updateTitle();
    // Observa mudanças de título feitas por transições de rota do Next.js
    const observer = new MutationObserver(updateTitle);
    const titleEl = document.querySelector("title");
    if (titleEl) {
      observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }
    return () => observer.disconnect();
  }, [brandName]);

  return null;
}
