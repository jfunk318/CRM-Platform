"use client";

import { useState } from "react";

export type RowColumn = {
  name: string;
  label: string;
  placeholder?: string;
  suffix?: string;
  type?: "text" | "checkbox" | "select" | "hidden";
  options?: { value: string; label: string }[];
  width?: string;
};

type Row = Record<string, string | boolean>;

/**
 * Editable list of rows inside a form. Each column's inputs share one name,
 * so the server reads them with formData.getAll(name), aligned by position.
 * Checkboxes are sent as "on"/"" through a hidden input to keep alignment.
 */
export function RowsEditor({
  columns,
  initialRows,
  addLabel = "Add row",
}: {
  columns: RowColumn[];
  initialRows: Row[];
  addLabel?: string;
}) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const blank = () =>
    Object.fromEntries(
      columns.map((c) => [c.name, c.type === "checkbox" ? false : c.type === "select" ? (c.options?.[0]?.value ?? "") : ""]),
    );
  const visible = columns.filter((c) => c.type !== "hidden");
  const hidden = columns.filter((c) => c.type === "hidden");

  const update = (i: number, name: string, value: string | boolean) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [name]: value } : r)));

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              {visible.map((c) => (
                <th key={c.name} style={{ width: c.width }}>{c.label}</th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {visible.map((c, ci) => (
                  <td key={c.name}>
                    {ci === 0 &&
                      hidden.map((h) => <input key={h.name} type="hidden" name={h.name} value={String(row[h.name] ?? "")} />)}
                    {c.type === "select" ? (
                      <select
                        className="input"
                        name={c.name}
                        aria-label={c.label}
                        value={String(row[c.name] ?? "")}
                        onChange={(e) => update(i, c.name, e.target.value)}
                      >
                        {c.options?.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : c.type === "checkbox" ? (
                      <>
                        <input
                          type="checkbox"
                          aria-label={c.label}
                          checked={Boolean(row[c.name])}
                          onChange={(e) => update(i, c.name, e.target.checked)}
                        />
                        <input type="hidden" name={c.name} value={row[c.name] ? "on" : ""} />
                      </>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          className="input"
                          name={c.name}
                          aria-label={c.label}
                          placeholder={c.placeholder}
                          // Keep narrow number columns readable when the table is squeezed.
                          style={c.width ? { minWidth: c.suffix ? `calc(${c.width} - 1.5rem)` : c.width } : undefined}
                          value={String(row[c.name] ?? "")}
                          onChange={(e) => update(i, c.name, e.target.value)}
                        />
                        {c.suffix && <span className="text-xs text-gray-500">{c.suffix}</span>}
                      </div>
                    )}
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-red-600"
                    aria-label="Remove row"
                    onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn-secondary" onClick={() => setRows((rs) => [...rs, blank()])}>
        + {addLabel}
      </button>
    </div>
  );
}
