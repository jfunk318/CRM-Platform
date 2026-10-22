"use client";

import { useEffect, useState } from "react";
import type { OrderOptions } from "@/app/admin/api/products/[id]/order-options/route";

export type DecorationValue = {
  methodId: string;
  areaId: string;
  location: string;
  colors: string;
  stitches: string;
  widthIn: string;
  heightIn: string;
  inkColors: string;
  needsArtwork: boolean;
  needsDigitizing: boolean;
  reuseScreens: boolean;
};

export type LineValue = {
  productId: string;
  colorId: string;
  quantities: Record<string, string>;
  decorations: DecorationValue[];
  notes: string;
};

const blankDecoration = (): DecorationValue => ({
  methodId: "",
  areaId: "",
  location: "",
  colors: "",
  stitches: "",
  widthIn: "",
  heightIn: "",
  inkColors: "",
  needsArtwork: false,
  needsDigitizing: false,
  reuseScreens: false,
});

/**
 * Configure one quote/order line: product, color, size quantities and
 * decorations. Renders plain inputs for the surrounding <ActionForm>;
 * decoration rows use repeated `d_*` names aligned by position.
 */
export function LineEditor({
  products,
  initial,
  sizeMode = "quantity",
}: {
  products: { id: string; name: string; styleCode: string }[];
  initial?: LineValue;
  /** "select": tick which sizes to sell (store items) instead of entering quantities. */
  sizeMode?: "quantity" | "select";
}) {
  const [value, setValue] = useState<LineValue>(
    initial ?? { productId: "", colorId: "", quantities: {}, decorations: [], notes: "" },
  );
  const [options, setOptions] = useState<OrderOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!value.productId) return;
    let cancelled = false;
    fetch(`/admin/api/products/${value.productId}/order-options`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((o: OrderOptions) => {
        if (cancelled) return;
        setOptions(o);
        setLoadError(null);
        // Keep the chosen color if this product has it, else pick the first.
        setValue((v) => ({ ...v, colorId: o.colors.some((c) => c.id === v.colorId) ? v.colorId : (o.colors[0]?.id ?? "") }));
      })
      .catch(() => !cancelled && setLoadError("Couldn't load this product's options. Reload the page and try again."));
    return () => {
      cancelled = true;
    };
  }, [value.productId]);

  const color = options?.colors.find((c) => c.id === value.colorId);
  const setDecoration = (i: number, patch: Partial<DecorationValue>) =>
    setValue((v) => ({ ...v, decorations: v.decorations.map((d, j) => (j === i ? { ...d, ...patch } : d)) }));
  const totalQty = Object.values(value.quantities).reduce((n, q) => n + (Number(q) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="le-product">Product</label>
          <select
            className="input"
            id="le-product"
            name="productId"
            value={value.productId}
            onChange={(e) => {
              setOptions(null);
              setValue((v) => ({ ...v, productId: e.target.value }));
            }}
            required
          >
            <option value="" disabled>Choose a product…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.styleCode})</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="le-color">Color</label>
          <select
            className="input"
            id="le-color"
            name="colorId"
            value={value.colorId}
            onChange={(e) => setValue((v) => ({ ...v, colorId: e.target.value }))}
            disabled={!options}
            required
          >
            {options?.colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      {options && (
        <>
          <div>
            <div className="label">
              {sizeMode === "select" ? "Sizes to sell" : <>Quantities {totalQty > 0 && <span className="text-gray-400">({totalQty} total)</span>}</>}
            </div>
            <div className="flex flex-wrap gap-2">
              {options.sizes.map((s) => {
                if (sizeMode === "select") {
                  const offered = color?.sizeIds.includes(s.id);
                  return (
                    <label key={s.id} className={`flex items-center gap-1 rounded border px-2 py-1 text-sm ${offered ? "border-gray-200" : "border-gray-100 text-gray-300 line-through"}`}>
                      <input type="checkbox" name={`size_${s.id}`} defaultChecked={offered} disabled={!offered} /> {s.code}
                    </label>
                  );
                }
                const offered = color?.sizeIds.includes(s.id);
                return (
                  <div key={s.id} className="w-16">
                    <label className={`text-xs ${offered ? "text-gray-600" : "text-gray-300 line-through"}`} htmlFor={`le-q-${s.id}`}>
                      {s.code}
                    </label>
                    <input
                      className="input"
                      id={`le-q-${s.id}`}
                      name={`qty_${s.id}`}
                      inputMode="numeric"
                      disabled={!offered}
                      value={offered ? (value.quantities[s.id] ?? "") : ""}
                      onChange={(e) => setValue((v) => ({ ...v, quantities: { ...v.quantities, [s.id]: e.target.value } }))}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="label">Decorations</div>
            {value.decorations.length === 0 && <p className="text-sm text-gray-500">None. The item is sold blank.</p>}
            {value.decorations.map((d, i) => {
              const method = options.methods.find((m) => m.id === d.methodId);
              const model = method?.pricingModel;
              return (
                <div key={i} className="space-y-2 rounded-md border border-gray-200 p-2">
                  <input type="hidden" name="d_area" value={d.areaId} />
                  <input type="hidden" name="d_art" value={d.needsArtwork ? "on" : ""} />
                  <input type="hidden" name="d_dig" value={d.needsDigitizing ? "on" : ""} />
                  <input type="hidden" name="d_reuse" value={d.reuseScreens ? "on" : ""} />
                  <div className="grid gap-2 sm:grid-cols-6 sm:items-end">
                    <div className="sm:col-span-2">
                      <label className="text-xs text-gray-500" htmlFor={`d-m-${i}`}>Method</label>
                      <select
                        className="input"
                        id={`d-m-${i}`}
                        name="d_method"
                        value={d.methodId}
                        onChange={(e) => setDecoration(i, { methodId: e.target.value })}
                        required
                      >
                        <option value="" disabled>Choose…</option>
                        {options.methods.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}{m.minQty > 1 ? ` (min ${m.minQty})` : ""}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs text-gray-500" htmlFor={`d-l-${i}`}>Location</label>
                      <select
                        className="input"
                        id={`d-l-${i}`}
                        value={d.areaId || (d.location ? "__custom" : "")}
                        onChange={(e) => {
                          const area = options.areas.find((a) => a.id === e.target.value);
                          setDecoration(
                            i,
                            area
                              ? { areaId: area.id, location: area.label, widthIn: d.widthIn || String(area.widthIn), heightIn: d.heightIn || String(area.heightIn) }
                              : { areaId: "", location: e.target.value === "__custom" ? d.location || " " : "" },
                          );
                        }}
                      >
                        <option value="">Choose…</option>
                        {options.areas.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                        <option value="__custom">Other…</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs text-gray-500" htmlFor={`d-loc-${i}`}>Location name</label>
                      <input
                        className="input"
                        id={`d-loc-${i}`}
                        name="d_location"
                        value={d.location.trimStart()}
                        onChange={(e) => setDecoration(i, { location: e.target.value })}
                        placeholder="e.g. Left Sleeve"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-6 sm:items-end">
                    <Small label={`Ink colors${method?.maxColors ? ` (max ${method.maxColors})` : ""}`} name="d_colors" value={d.colors} onChange={(v) => setDecoration(i, { colors: v })} hidden={model !== "PER_COLOR"} />
                    <Small label="Stitches" name="d_stitches" value={d.stitches} onChange={(v) => setDecoration(i, { stitches: v })} hidden={model !== "PER_STITCH"} />
                    <Small label="Width (in)" name="d_w" value={d.widthIn} onChange={(v) => setDecoration(i, { widthIn: v })} />
                    <Small label="Height (in)" name="d_h" value={d.heightIn} onChange={(v) => setDecoration(i, { heightIn: v })} />
                    <div className="sm:col-span-2">
                      <label className="text-xs text-gray-500" htmlFor={`d-ink-${i}`}>Ink / thread colors</label>
                      <input className="input" id={`d-ink-${i}`} name="d_inks" value={d.inkColors} onChange={(e) => setDecoration(i, { inkColors: e.target.value })} placeholder="White, PMS 186" />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <Check label="Needs artwork" checked={d.needsArtwork} onChange={(c) => setDecoration(i, { needsArtwork: c })} />
                    {model === "PER_STITCH" && <Check label="Needs digitizing" checked={d.needsDigitizing} onChange={(c) => setDecoration(i, { needsDigitizing: c })} />}
                    {model === "PER_COLOR" && <Check label="Reuse existing screens" checked={d.reuseScreens} onChange={(c) => setDecoration(i, { reuseScreens: c })} />}
                    <button
                      type="button"
                      className="ml-auto text-red-600 hover:underline"
                      onClick={() => setValue((v) => ({ ...v, decorations: v.decorations.filter((_, j) => j !== i) }))}
                    >
                      Remove decoration
                    </button>
                  </div>
                </div>
              );
            })}
            <button type="button" className="btn-secondary" onClick={() => setValue((v) => ({ ...v, decorations: [...v.decorations, blankDecoration()] }))}>
              + Add decoration
            </button>
          </div>

          <div>
            <label className="label" htmlFor="le-notes">Item notes</label>
            <input className="input" id="le-notes" name="notes" value={value.notes} onChange={(e) => setValue((v) => ({ ...v, notes: e.target.value }))} />
          </div>
        </>
      )}
    </div>
  );
}

function Small({ label, name, value, onChange, hidden }: { label: string; name: string; value: string; onChange: (v: string) => void; hidden?: boolean }) {
  // Hidden fields still submit (empty) so repeated d_* names stay aligned.
  if (hidden) return <input type="hidden" name={name} value="" />;
  return (
    <div>
      <label className="text-xs text-gray-500">
        {label}
        <input className="input" name={name} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}
