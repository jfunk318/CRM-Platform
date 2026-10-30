"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import type { StyleSummary } from "@/lib/catalog/import/sanmar";
import { startImportAction } from "../actions";

type Choice = { brands: string[] | null; categories: string[] | null; includeDiscontinued: boolean; cost: string };

/** Pick brands, categories, discontinued and which price is your cost, with live counts. */
export function ImportChooser({ id, styles, previous }: { id: string; styles: StyleSummary[]; previous: Choice | null }) {
  const [state, action, pending] = useActionState(startImportAction, {});
  const brands = useMemo(() => count(styles.map((s) => s[1])), [styles]);
  const categories = useMemo(() => count(styles.flatMap((s) => s[2])), [styles]);
  const [pickedBrands, setBrands] = useState<Set<string>>(new Set(previous?.brands ?? (previous ? brands.map(([b]) => b) : [])));
  const [allCats, setAllCats] = useState(previous ? previous.categories === null : true);
  const [pickedCats, setCats] = useState<Set<string>>(new Set(previous?.categories ?? []));
  const [discontinued, setDiscontinued] = useState(previous?.includeDiscontinued ?? false);
  const [brandFilter, setBrandFilter] = useState("");

  const chosen = styles.filter(
    ([, brand, cats, disc]) => pickedBrands.has(brand) && (discontinued || !disc) && (allCats || cats.some((c) => pickedCats.has(c))),
  );
  const totals = { styles: chosen.length, colors: chosen.reduce((n, s) => n + s[4], 0), skus: chosen.reduce((n, s) => n + s[5], 0) };
  const toggle = (set: Set<string>, v: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    setter(next);
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <input type="hidden" name="id" value={id} />
      {pickedBrands.size === brands.length && <input type="hidden" name="allBrands" value="on" />}
      {[...pickedBrands].map((b) => <input key={b} type="hidden" name="brands" value={b} />)}
      {allCats && <input type="hidden" name="allCategories" value="on" />}
      {!allCats && [...pickedCats].map((c) => <input key={c} type="hidden" name="categories" value={c} />)}

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Brands <span className="text-sm font-normal text-gray-500">({pickedBrands.size} of {brands.length})</span></h2>
          <div className="flex items-center gap-3 text-sm">
            <input className="input w-44" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} placeholder="Find a brand" aria-label="Find a brand" />
            <button type="button" className="text-brand-700 hover:underline" onClick={() => setBrands(new Set(brands.map(([b]) => b)))}>All</button>
            <button type="button" className="text-brand-700 hover:underline" onClick={() => setBrands(new Set())}>None</button>
          </div>
        </div>
        <div className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-3 lg:grid-cols-4" data-testid="brands">
          {brands
            .filter(([b]) => b.toLowerCase().includes(brandFilter.toLowerCase()))
            .map(([b, n]) => (
              <label key={b} className="flex items-center gap-2">
                <input type="checkbox" checked={pickedBrands.has(b)} onChange={() => toggle(pickedBrands, b, setBrands)} aria-label={b} />
                {b || "(no brand)"} <span className="text-xs text-gray-500">{n}</span>
              </label>
            ))}
        </div>
      </section>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="font-semibold">Categories</h2>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allCats} onChange={(e) => setAllCats(e.target.checked)} /> All categories</label>
        </div>
        {!allCats && (
          <div className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-3 lg:grid-cols-4" data-testid="categories">
            {categories.map(([c, n]) => (
              <label key={c} className="flex items-center gap-2">
                <input type="checkbox" checked={pickedCats.has(c)} onChange={() => toggle(pickedCats, c, setCats)} aria-label={c} />
                {c} <span className="text-xs text-gray-500">{n}</span>
              </label>
            ))}
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="includeDiscontinued" checked={discontinued} onChange={(e) => setDiscontinued(e.target.checked)} /> Include discontinued styles
        </label>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Your cost</h2>
        <p className="text-sm text-gray-500">Your markup is added on top of this price. Piece is what you pay for single pieces; case is the lower price for full cases.</p>
        <div className="flex flex-wrap gap-4 text-sm">
          {[["piece", "Piece price (recommended)"], ["dozen", "Dozen price"], ["case", "Case price"]].map(([v, l]) => (
            <label key={v} className="flex items-center gap-2"><input type="radio" name="cost" value={v} defaultChecked={(previous?.cost ?? "piece") === v} /> {l}</label>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button className="btn" disabled={pending || totals.styles === 0}>
          {pending ? "Starting…" : `Import ${totals.styles.toLocaleString()} style${totals.styles === 1 ? "" : "s"}`}
        </button>
        <span className="text-sm text-gray-600" data-testid="import-totals">
          {totals.colors.toLocaleString()} colors · {totals.skus.toLocaleString()} SKUs
        </span>
        {!pending && state.error && <span className="text-sm text-red-600" role="status">{state.error}</span>}
        {!pending && state.ok && <span className="text-sm text-green-700" role="status">{state.ok}</span>}
      </div>
    </form>
  );
}

/** [value, how many styles] sorted by count. */
function count(values: string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
