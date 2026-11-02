"use client";

import { useState } from "react";
import type { ActionResult } from "@/lib/admin/form";
import { ActionButton } from "./action-button";

type RowAction = { action: (prev: ActionResult, form: FormData) => Promise<ActionResult>; fields: Record<string, string>; label: string; confirm?: string };

/**
 * A compact row in a settings list: its summary, with Edit opening its form
 * underneath and an optional Delete beside it. With no summary, the row is
 * just its edit link (e.g. "+ Add a delivery method").
 */
export function ListRow({ children, editor, editLabel = "Edit", remove, testId }: { children?: React.ReactNode; editor: React.ReactNode; editLabel?: string; remove?: RowAction; testId?: string }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="px-4 py-3" data-testid={testId}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {children ?? (
            <button type="button" className="text-sm font-medium text-brand-700 hover:underline" aria-expanded={editing} onClick={() => setEditing((e) => !e)}>
              {editing ? "Cancel" : editLabel}
            </button>
          )}
        </div>
        {children && (
          <div className="flex shrink-0 items-center gap-3 text-xs">
            <button type="button" className="font-medium text-brand-700 hover:underline" aria-expanded={editing} onClick={() => setEditing((e) => !e)}>
              {editing ? "Close" : editLabel}
            </button>
            {remove && <ActionButton action={remove.action} fields={remove.fields} confirm={remove.confirm} label={remove.label} className="text-red-700 hover:underline" />}
          </div>
        )}
      </div>
      {editing && <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4">{editor}</div>}
    </div>
  );
}
