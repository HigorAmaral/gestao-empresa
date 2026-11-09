"use client";

import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/form";

/**
 * Formulário ligado a uma server action que retorna { error } / { success }.
 * O envio é feito manualmente para que os campos NÃO sejam limpos quando há erro de validação.
 */
export function ActionForm({
  action,
  children,
  submitLabel = "Salvar",
  extraActions,
  resetOnSuccess,
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  children: ReactNode;
  submitLabel?: string;
  extraActions?: ReactNode;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.success) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      {state?.error && <div className="alert error">{state.error}</div>}
      {state?.success && <div className="alert success">{state.success}</div>}
      {children}
      <div className="form-actions">
        {extraActions}
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Salvando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

/** Botão que executa uma server action após confirmação. */
export function ConfirmButton({
  action,
  label,
  confirmText,
  className = "btn sm secondary",
}: {
  action: () => Promise<void>;
  label: string;
  confirmText?: string;
  className?: string;
}) {
  return (
    <form
      className="inline-form"
      action={action}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <PendingButton label={label} className={className} />
    </form>
  );
}

function PendingButton({ label, className }: { label: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? "..." : label}
    </button>
  );
}
