"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import type { ActionResult } from "@/lib/admin/form";

type Props = {
  action: (prev: ActionResult, form: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
  /** Ask before submitting, e.g. for deletes. */
  confirm?: string;
  danger?: boolean;
  /** Clear the inputs after a successful save (for "add new" forms). */
  resetOnSuccess?: boolean;
  /** Told after each successful save, with its message. */
  onSaved?: (message: string) => void;
};

/** A form bound to an admin server action, with saved/error feedback. */
export function ActionForm({ action, children, submitLabel = "Save", className, confirm, danger, resetOnSuccess, onSaved }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.ok) formRef.current?.reset();
    if (state.ok) onSaved?.(state.ok);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per result, not per render of the callback
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      className={className ?? "space-y-4"}
      // Submitting through onSubmit (not the `action` prop) stops React from
      // resetting the form, so a validation error doesn't wipe what was typed.
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      {children}
      <div className="flex items-center gap-3">
        <button className={danger ? "btn-danger" : "btn"} disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {!pending && state.error && <span className="text-sm text-red-600" role="status">{state.error}</span>}
        {!pending && state.ok && <span className="text-sm text-green-700" role="status">{state.ok}</span>}
      </div>
    </form>
  );
}
