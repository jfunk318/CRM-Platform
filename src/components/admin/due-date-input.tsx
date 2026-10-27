"use client";

import { useState } from "react";

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
];

const iso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** A due date with one-click choices (Today, Tomorrow…). */
export function DueDateInput({ id, defaultValue = "" }: { id: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="space-y-1">
      <input className="input" id={id} name="dueDate" type="date" value={value} onChange={(e) => setValue(e.target.value)} />
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className={`rounded border px-1.5 py-0.5 text-[11px] ${value === iso(p.days) ? "border-amber-500 bg-amber-50" : "border-gray-200 hover:border-amber-300"}`} onClick={() => setValue(iso(p.days))}>
            {p.label}
          </button>
        ))}
        {value && (
          <button type="button" className="px-1 text-[11px] text-gray-500 hover:underline" onClick={() => setValue("")}>
            No date
          </button>
        )}
      </div>
    </div>
  );
}
