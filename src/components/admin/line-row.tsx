"use client";

import { useState } from "react";
import type { ActionResult } from "@/lib/admin/form";
import { ActionButton } from "./action-button";

/**
 * One item on a quote or order as a compact list row: thumbnail, details,
 * price, with Edit opening the item editor underneath and Remove beside it.
 */
export function LineRow({
  thumb,
  children,
  price,
  editor,
  remove,
}: {
  thumb: React.ReactNode;
  children: React.ReactNode;
  price: React.ReactNode;
  editor?: React.ReactNode;
  /** The remove action and its fields; a Remove link when given. */
  remove?: { action: (prev: ActionResult, form: FormData) => Promise<ActionResult>; fields: Record<string, string> };
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="px-4 py-3" data-testid="line">
      <div className="flex items-start gap-3">
        {thumb}
        <div className="min-w-0 flex-1 space-y-0.5 text-sm">{children}</div>
        <div className="shrink-0 text-right">{price}</div>
        {(editor || remove) && (
          <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5 text-xs">
            {editor && (
              <button type="button" className="font-medium text-brand-700 hover:underline" aria-expanded={editing} onClick={() => setEditing((e) => !e)}>
                {editing ? "Close" : "Edit"}
              </button>
            )}
            {remove && <ActionButton action={remove.action} fields={remove.fields} confirm="Remove this item?" className="text-red-700 hover:underline" label="Remove" />}
          </div>
        )}
      </div>
      {editing && editor && <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4">{editor}</div>}
    </div>
  );
}
