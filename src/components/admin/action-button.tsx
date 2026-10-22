"use client";

import { startTransition, useActionState } from "react";
import type { ActionResult } from "@/lib/admin/form";

/**
 * A one-click action (tick a step, send, cancel…) with hidden fields. Shows
 * only errors; success shows up as the page refreshing.
 */
export function ActionButton({
  action,
  fields,
  label,
  className = "btn-secondary px-2 py-1 text-xs",
  confirm,
  title,
}: {
  action: (prev: ActionResult, form: FormData) => Promise<ActionResult>;
  fields: Record<string, string>;
  label: React.ReactNode;
  className?: string;
  confirm?: string;
  title?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      className="inline-flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button className={className} disabled={pending} title={title}>
        {label}
      </button>
      {!pending && state.error && <span className="text-xs text-red-600" role="status">{state.error}</span>}
    </form>
  );
}
