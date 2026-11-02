"use client";

import { startTransition, useActionState } from "react";
import type { ActionResult } from "@/lib/admin/form";

/** A checkbox that saves as soon as it's ticked or unticked (sent as `name`=on, with hidden fields). */
export function ToggleAction({
  action,
  fields,
  name,
  checked,
  label,
  title,
  testId,
}: {
  action: (prev: ActionResult, form: FormData) => Promise<ActionResult>;
  fields: Record<string, string>;
  name: string;
  checked: boolean;
  label: React.ReactNode;
  title?: string;
  testId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <label className="flex items-center gap-2" title={title}>
        <input
          type="checkbox"
          defaultChecked={checked}
          disabled={pending}
          data-testid={testId}
          onChange={(e) => {
            const data = new FormData();
            for (const [k, v] of Object.entries(fields)) data.set(k, v);
            if (e.currentTarget.checked) data.set(name, "on");
            startTransition(() => formAction(data));
          }}
        />
        {label}
      </label>
      {!pending && state.error && <span className="text-xs text-red-600" role="status">{state.error}</span>}
    </span>
  );
}
