"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/admin/form";

type Props = {
  action: (prev: ActionResult, form: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
  /** Ask before submitting, e.g. for deletes. */
  confirm?: string;
  danger?: boolean;
};

/** A form bound to an admin server action, with saved/error feedback. */
export function ActionForm({ action, children, submitLabel = "Save", className, confirm, danger }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className={className ?? "space-y-4"}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
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
