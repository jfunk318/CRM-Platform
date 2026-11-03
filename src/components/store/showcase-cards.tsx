"use client";

import { useState } from "react";

export type ShowcaseCard = {
  id: string;
  name: string;
  tagline: string | null;
  url: string;
  logo: string | null;
  accent: string | null;
  group: string | null;
  status: string;
  pictures: { id: string; src: string; name: string }[];
};

/** A store's color as a soft gradient; stores without one use the site's accent. */
const tile = (accent: string | null) => {
  const c = accent ?? "var(--accent)";
  return { background: `linear-gradient(135deg, ${c}, color-mix(in srgb, ${c} 70%, black))` };
};

const COLS = ["", "sm:grid-cols-1", "sm:grid-cols-2", "sm:grid-cols-3", "sm:grid-cols-4", "sm:grid-cols-5", "sm:grid-cols-6"];

/** Store cards as a grid or a list, with an optional search box and group buttons for shoppers. */
export function ShowcaseCards({ stores, layout, columns, filters }: { stores: ShowcaseCard[]; layout: "grid" | "list"; columns: number; filters: boolean }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const groups = [...new Set(stores.map((s) => s.group).filter((g): g is string => !!g))].sort();
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = stores.filter((s) => (!group || s.group === group) && words.every((w) => `${s.name} ${s.tagline ?? ""} ${s.group ?? ""}`.toLowerCase().includes(w)));

  return (
    <div className="my-6 space-y-4" data-testid="showcase">
      {filters && (
        <div className="flex flex-wrap items-center gap-2" data-testid="showcase-filters">
          <input className="input max-w-xs" type="search" placeholder="Find your store" aria-label="Find a store" value={q} onChange={(e) => setQ(e.target.value)} />
          {groups.length > 1 &&
            [null, ...groups].map((g) => (
              <button
                key={g ?? "all"}
                type="button"
                onClick={() => setGroup(g)}
                className={`rounded-full border px-3 py-1 text-sm ${group === g ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]" : "border-[var(--st-border)] hover:border-[var(--accent)]"}`}
              >
                {g ?? "All"}
              </button>
            ))}
        </div>
      )}
      {shown.length === 0 && <p className="text-[var(--st-muted)]">{stores.length ? "No stores match." : "No stores to show right now."}</p>}
      {layout === "list" ? (
        <ul className="divide-y divide-[var(--st-border)] rounded-lg border border-[var(--st-border)] bg-[var(--st-surface)]">
          {shown.map((s) => (
            <li key={s.id}>
              <a href={s.url} className="group flex items-center gap-4 p-3 hover:bg-[var(--st-subtle)]">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md" style={tile(s.accent)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {s.logo ? <img src={s.logo} alt="" className="max-h-10 w-auto" /> : <span className="text-lg font-bold text-white drop-shadow">{s.name.slice(0, 1)}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold group-hover:text-[var(--accent)]">{s.name}</span>
                  <span className="block truncate text-sm text-[var(--st-muted)]">{[s.tagline, s.group].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="hidden text-xs text-[var(--st-muted)] sm:block">{s.status}</span>
                <span className="text-sm text-[var(--accent)]">Visit →</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div className={`grid grid-cols-2 gap-5 ${COLS[columns]}`}>
          {shown.map((s) => (
            <a key={s.id} href={s.url} className="group flex flex-col overflow-hidden border border-[var(--st-border)] bg-[var(--st-surface)] transition duration-200 hover:-translate-y-1 hover:shadow-xl" style={{ borderRadius: "var(--st-radius)" }}>
              <div className="relative flex h-32 items-center justify-center overflow-hidden p-4" style={tile(s.accent)}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgb(255_255_255/0.25),transparent_55%)]" />
                {s.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.logo} alt={s.name} className="relative max-h-20 w-auto drop-shadow transition duration-300 group-hover:scale-105" />
                ) : (
                  <span className="st-heading relative text-center text-xl leading-tight text-white drop-shadow">{s.name}</span>
                )}
                {s.group && <span className="absolute top-2 left-2 rounded-full bg-black/30 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">{s.group}</span>}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-4">
                <div className="font-semibold group-hover:text-[var(--accent)]">{s.name}</div>
                {s.tagline && <div className="line-clamp-2 text-sm text-[var(--st-muted)]">{s.tagline}</div>}
                {s.pictures.length > 0 && (
                  <div className="flex gap-1.5 pt-1">
                    {s.pictures.map((p) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={p.id} src={p.src} alt={p.name} className="h-11 w-11 rounded-md bg-[var(--st-subtle)] object-cover" />
                    ))}
                  </div>
                )}
                <div className="mt-auto flex items-center justify-between pt-2 text-xs">
                  <span className="flex items-center gap-1.5 text-[var(--st-muted)]">
                    <span className={`h-1.5 w-1.5 rounded-full ${s.status.startsWith("Open") ? "bg-green-500" : "bg-gray-400"}`} />
                    {s.status}
                  </span>
                  <span className="font-semibold text-[var(--accent)]">Visit →</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
