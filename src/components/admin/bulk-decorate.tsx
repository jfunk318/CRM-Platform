"use client";

import { useEffect, useMemo, useState } from "react";
import type { OrderOptions } from "@/app/admin/api/products/[id]/order-options/route";
import { addLinesAction, updateLinesAction } from "@/app/admin/(panel)/orders/actions";
import { Mockup, type MockupLayer } from "@/components/mockup";
import { locationKey, matchArea, mergeDecorations, placeDecoration, referenceWidths, type SizeMode } from "@/lib/design/apply";
import type { ArtOwnerIds } from "@/lib/design/artwork";
import { DEFAULT_GUIDES } from "@/lib/design/guides";
import { photoRect } from "@/lib/design/placement";
import { ActionForm } from "./action-form";
import { type DecorationValue, DesignStudio, type StudioOther } from "./design-studio";
import type { LineValue } from "./line-editor";
import { decorationForPrice, money, PriceSummary, quantitiesForPrice, useLivePrices } from "./live-price";
import { ProductPicker, type PickedProduct } from "./product-picker";

/** An item already on the order, for bulk updates. */
export type BulkLine = { lineId: string; label: string; product: PickedProduct; total: string; value: LineValue };

type Target = {
  key: string;
  lineId?: string;
  product: PickedProduct | null;
  productId: string;
  colorId: string;
  quantities: Record<string, string>;
  /** The item's decorations before this change (none for new items). */
  base: DecorationValue[];
  notes: string;
  roster?: string;
  label: string;
  currentTotal?: string;
};

type Design = { source: DecorationValue; sourceAreaId: string | null; designedOn: string };
type Studio = { kind: "design" } | { kind: "tune"; targetKey: string; loc: string } | null;

let nextKey = 0;
const newRow = (): Target => ({ key: `n${nextKey++}`, product: null, productId: "", colorId: "", quantities: {}, base: [], notes: "", label: "" });
const k2 = (targetKey: string, loc: string) => `${targetKey}|${locationKey(loc)}`;

/**
 * One decoration on many items at once. "add": choose several products,
 * design the decoration once, and it's placed on each at the chosen
 * locations, sized by the placement guides. "update": choose items already
 * on the order and put new artwork on them, or adjust the decoration they
 * have at a location. Every item ends up with its own copy; unchosen items
 * aren't touched, and any item can be fine-tuned on its own before saving.
 */
export function BulkDecorate({ mode, orderId, artOwner, lines = [] }: { mode: "add" | "update"; orderId: string; artOwner: ArtOwnerIds & { name: string }; lines?: BulkLine[] }) {
  const [rows, setRows] = useState<Target[]>(() => [newRow(), newRow()]);
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState<"replace" | "adjust">("replace");
  const [adjustLoc, setAdjustLoc] = useState("");
  const [useSameArt, setUseSameArt] = useState(true);
  const [options, setOptions] = useState<Record<string, OrderOptions>>({});
  const [step, setStep] = useState<"items" | "place">("items");
  const [design, setDesign] = useState<Design | null>(null);
  const [studio, setStudio] = useState<Studio>(null);
  const [locations, setLocations] = useState<string[]>([]);
  const [sizeMode, setSizeMode] = useState<SizeMode>("same");
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [tuned, setTuned] = useState<Record<string, DecorationValue>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // After saving, start over (the new or changed items show on the page).
  const reset = (message: string) => {
    setDone(message);
    setStep("items");
    setDesign(null);
    setTuned({});
    setPicks({});
    setLocations([]);
    setSelected([]);
    if (mode === "add") setRows([newRow(), newRow()]);
  };

  const targets: Target[] = useMemo(
    () =>
      mode === "add"
        ? rows.filter((r) => r.productId && r.colorId)
        : lines
            .filter((l) => selected.includes(l.lineId))
            .map((l) => ({
              key: l.lineId,
              lineId: l.lineId,
              product: l.product,
              productId: l.value.productId,
              colorId: l.value.colorId,
              quantities: l.value.quantities,
              base: l.value.decorations,
              notes: l.value.notes,
              roster: l.value.roster,
              label: l.label,
              currentTotal: l.total,
            })),
    [mode, rows, lines, selected],
  );

  // Each product's options (colors, sizes, print areas, methods), loaded once.
  const productIds = useMemo(() => [...new Set([...rows.map((r) => r.productId), ...lines.map((l) => l.value.productId)].filter(Boolean))], [rows, lines]);
  useEffect(() => {
    for (const id of productIds) {
      if (options[id]) continue;
      fetch(`/admin/api/products/${id}/order-options`)
        .then((r) => (r.ok ? r.json() : null))
        .then((o: OrderOptions | null) => o && setOptions((all) => ({ ...all, [id]: o })));
    }
  }, [productIds, options]);

  // A product just picked starts on its first color once its options arrive.
  useEffect(() => {
    if (rows.some((r) => r.productId && !r.colorId && options[r.productId]))
      setRows((all) => all.map((r) => (r.productId && !r.colorId && options[r.productId] ? { ...r, colorId: options[r.productId].colors[0]?.id ?? "" } : r)));
  }, [rows, options]);

  const first = targets.find((t) => options[t.productId]);
  const firstOpts = first ? options[first.productId] : null;
  const guides = firstOpts?.guides ?? DEFAULT_GUIDES;
  const adjusting = mode === "update" && action === "adjust";

  // Locations offered: every print area across the chosen products.
  const allLocations = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of targets) for (const a of options[t.productId]?.areas ?? []) if (!seen.has(locationKey(a.label))) seen.set(locationKey(a.label), a.label);
    return [...seen.values()];
  }, [targets, options]);
  // For adjusting: locations the chosen items already have decorations at.
  const existingLocations = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of targets) for (const d of t.base) if (!seen.has(locationKey(d.location))) seen.set(locationKey(d.location), d.location);
    return [...seen.values()];
  }, [targets]);

  // ─── Place the designed decoration on every item ──────────────────────────
  const results = useMemo(() => {
    if (!design) return [];
    const art = design.source.artwork;
    const refs = art ? referenceWidths(locations.filter((l) => locationKey(l) !== locationKey(design.designedOn)), targets.map((t) => options[t.productId]?.areas ?? []), art, guides) : new Map<string, number>();
    const sourceArea = firstOpts?.areas.find((a) => a.id === design.sourceAreaId) ?? null;
    return targets.map((t) => {
      const opts = options[t.productId];
      if (!opts) return { target: t, opts: null, entries: [], decorations: t.base, error: "Loading…" };
      const method = opts.methods.find((m) => m.id === design.source.methodId);
      if (!method) return { target: t, opts, entries: [], decorations: t.base, error: `${firstOpts?.methods.find((m) => m.id === design.source.methodId)?.name ?? "That method"} isn't offered for ${opts.name}` };
      const entries = locations.map((loc) => {
        const key = k2(t.key, loc);
        if (tuned[key]) return { loc, decoration: tuned[key], note: "fine-tuned" };
        if (picks[key] === "skip") return { loc, decoration: null, note: "skipped" };
        const area = picks[key] ? opts.areas.find((a) => a.id === picks[key]) : matchArea(opts.areas, loc, opts.guides);
        if (!area) return { loc, decoration: null, note: `${opts.name} has no ${loc.split("/").pop()!.trim().toLowerCase()} area` };
        let src = design.source;
        if (adjusting) {
          const own = t.base.find((d) => locationKey(d.location) === locationKey(loc));
          if (!own) return { loc, decoration: null, note: `nothing at ${loc} to adjust` };
          // Keep the item's own artwork; take the new size, position and process.
          if (!useSameArt) {
            src = {
              ...own,
              methodId: design.source.methodId,
              needsDigitizing: design.source.needsDigitizing,
              reuseScreens: design.source.reuseScreens,
              artwork: own.artwork && art ? { ...own.artwork, x: art.x, y: art.y, w: art.w, rotation: art.rotation } : own.artwork,
              widthIn: own.widthIn,
            };
          }
        }
        const placed = placeDecoration(src, sourceArea, area, { mode: sizeMode, guides: opts.guides, referenceWidthIn: refs.get(locationKey(loc)), stitchDensity: method.stitchDensity });
        if (!placed.decoration) return { loc, decoration: null, note: placed.reason };
        return { loc, decoration: placed.decoration, note: placed.shrunk ? "made smaller to fit" : null };
      });
      const incoming = entries.flatMap((e) => (e.decoration ? [e.decoration] : []));
      return { target: t, opts, entries, decorations: mergeDecorations(t.base, incoming), error: incoming.length ? null : "Nothing placed" };
    });
  }, [design, targets, options, locations, sizeMode, picks, tuned, guides, firstOpts, adjusting, useSameArt]);

  const ready = results.filter((r) => !r.error);
  const { prices, loading } = useLivePrices(
    orderId,
    step === "place" && ready.length
      ? ready.map((r) => ({ key: r.target.key, lineId: r.target.lineId, productId: r.target.productId, colorId: r.target.colorId, quantities: quantitiesForPrice(r.target.quantities), decorations: r.decorations.filter((d) => d.methodId).map(decorationForPrice) }))
      : null,
  );

  const layersFor = (opts: OrderOptions, decorations: DecorationValue[], viewId: string): MockupLayer[] =>
    decorations.flatMap((d) => {
      const a = opts.areas.find((x) => x.id === d.areaId);
      if (!a || a.viewId !== viewId || !d.artwork || !d.artworkUrl) return [];
      const r = photoRect(a, d.artwork, d.artwork);
      return [{ src: d.artworkUrl, left: r.left, top: r.top, width: r.width, rotation: d.artwork.rotation }];
    });
  const photoFor = (opts: OrderOptions, viewId: string, colorId: string) => {
    const photos = opts.views.find((v) => v.id === viewId)?.photos ?? {};
    return photos[colorId] ?? Object.values(photos)[0] ?? null;
  };

  const startDesign = () => {
    setProblem(null);
    setDone(null);
    if (targets.length === 0) return setProblem(mode === "add" ? "Choose at least one product and color" : "Tick the items to change");
    if (!firstOpts) return setProblem("Still loading the products; try again in a moment");
    if (adjusting && !adjustLoc) return setProblem("Choose the location to adjust");
    setStudio({ kind: "design" });
  };

  const payload = JSON.stringify(
    ready.map((r) => ({
      lineId: r.target.lineId,
      productId: r.target.productId,
      colorId: r.target.colorId,
      quantities: r.target.quantities,
      notes: r.target.notes,
      ...(r.target.roster !== undefined ? { roster: r.target.roster } : {}),
      // The artwork's URL is for showing it here; the server works from the file ids.
      decorations: r.decorations.map((d) => ({ ...d, artworkUrl: undefined })),
    })),
  );

  // ─── Step 1: the items ────────────────────────────────────────────────────
  const itemsStep = (
    <div className="space-y-3">
      {mode === "add" ? (
        <>
          <p className="text-sm text-gray-600">Choose the products (and colors). Quantities can be filled in now or later on each item.</p>
          {rows.map((r, i) => {
            const opts = r.productId ? options[r.productId] : null;
            const color = opts?.colors.find((c) => c.id === r.colorId);
            return (
              <div key={r.key} className="space-y-2 rounded-md border border-gray-200 p-2" data-testid="bulk-row">
                <div className="grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
                  <ProductPicker
                    id={`bulk-product-${r.key}`}
                    name={`bulk_product_${i}`}
                    selected={r.product}
                    onChange={(p) => setRows((all) => all.map((x) => (x.key === r.key ? { ...x, product: p, productId: p.id, label: p.name, colorId: options[p.id]?.colors[0]?.id ?? "", quantities: {} } : x)))}
                  />
                  <select
                    className="input"
                    aria-label="Color"
                    value={r.colorId}
                    disabled={!opts}
                    onChange={(e) => setRows((all) => all.map((x) => (x.key === r.key ? { ...x, colorId: e.target.value } : x)))}
                  >
                    <option value="">{opts ? "Color…" : "—"}</option>
                    {opts?.colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <button type="button" className="btn-secondary px-2 py-1 text-xs" title="Another color of this product" disabled={!r.productId} onClick={() => setRows((all) => [...all.slice(0, i + 1), { ...newRow(), product: r.product, productId: r.productId, label: r.label }, ...all.slice(i + 1)])}>
                      + Color
                    </button>
                    <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))}>Remove</button>
                  </div>
                </div>
                {opts && color && (
                  <div className="flex flex-wrap gap-1.5">
                    {opts.sizes.filter((s) => color.sizeIds.includes(s.id)).map((s) => (
                      <label key={s.id} className="w-14 text-[11px] text-gray-600">
                        {s.code}
                        <input
                          className="input px-1.5 py-1"
                          inputMode="numeric"
                          value={r.quantities[s.id] ?? ""}
                          onChange={(e) => setRows((all) => all.map((x) => (x.key === r.key ? { ...x, quantities: { ...x.quantities, [s.id]: e.target.value } } : x)))}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <button type="button" className="btn-secondary" onClick={() => setRows((all) => [...all, newRow()])}>+ Another product</button>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Tick the items to change. Items you don&apos;t tick stay as they are.</p>
            <button type="button" className="text-xs text-amber-700 hover:underline" onClick={() => setSelected(selected.length === lines.length ? [] : lines.map((l) => l.lineId))}>
              {selected.length === lines.length ? "Clear" : "Select all"}
            </button>
          </div>
          <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
            {lines.map((l) => (
              <li key={l.lineId}>
                <label className="flex items-center gap-3 px-3 py-2 text-sm">
                  <input type="checkbox" checked={selected.includes(l.lineId)} onChange={(e) => setSelected(e.target.checked ? [...selected, l.lineId] : selected.filter((x) => x !== l.lineId))} />
                  <span className="flex-1">{l.label}</span>
                  <span className="text-xs text-gray-500">{l.value.decorations.map((d) => d.location.split("/").pop()!.trim()).join(", ") || "blank"}</span>
                  <span className="w-20 text-right">{money(l.total)}</span>
                </label>
              </li>
            ))}
          </ul>
          <fieldset className="space-y-1 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" checked={action === "replace"} onChange={() => setAction("replace")} /> Put new artwork on them (replaces what&apos;s at the locations you choose)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={action === "adjust"} onChange={() => setAction("adjust")} /> Adjust the decoration they have at
              <select className="rounded border border-gray-300 px-1 py-0.5" value={adjustLoc} onChange={(e) => { setAdjustLoc(e.target.value); setAction("adjust"); }} aria-label="Location to adjust">
                <option value="">choose…</option>
                {existingLocations.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
          </fieldset>
        </>
      )}
      {problem && <p className="text-sm text-red-600">{problem}</p>}
      <button type="button" className="btn" onClick={startDesign} disabled={targets.some((t) => !options[t.productId])} data-testid="bulk-design">
        {targets.some((t) => !options[t.productId]) ? "Loading the products…" : adjusting ? "Adjust it →" : "Design the decoration →"}
      </button>
    </div>
  );

  // ─── Step 2: review where it landed on each item ──────────────────────────
  const placeStep = design && (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-6 text-sm">
        {!adjusting && (
          <fieldset>
            <legend className="label">Locations</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {allLocations.map((l) => (
                <label key={l} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={locations.some((x) => locationKey(x) === locationKey(l))} onChange={(e) => setLocations(e.target.checked ? [...locations, l] : locations.filter((x) => locationKey(x) !== locationKey(l)))} />
                  {l}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {design.source.artwork && (
          <fieldset>
            <legend className="label">Size</legend>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={sizeMode === "same"} onChange={() => setSizeMode("same")} /> The same print size on every item
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={sizeMode === "fit"} onChange={() => setSizeMode("fit")} /> Scaled to fit each product
            </label>
          </fieldset>
        )}
        {adjusting && design.source.artwork && (
          <fieldset>
            <legend className="label">Artwork</legend>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={useSameArt} onChange={() => setUseSameArt(true)} /> Use this artwork on all of them
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={!useSameArt} onChange={() => setUseSameArt(false)} /> Keep each item&apos;s own artwork (change size, position and process only)
            </label>
          </fieldset>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2" data-testid="bulk-results">
        {results.map((r) => {
          const opts = r.opts;
          const views = opts ? [...new Set(r.decorations.flatMap((d) => (d.artwork ? [opts.areas.find((a) => a.id === d.areaId)?.viewId] : [])).filter((v): v is string => !!v))] : [];
          return (
            <div key={r.target.key} className={`flex gap-3 rounded-md border p-2 ${r.error ? "border-red-200 bg-red-50/40" : "border-gray-200"}`} data-testid="bulk-result">
              <div className="flex shrink-0 gap-1">
                {opts && views.length > 0
                  ? views.map((v) => <Mockup key={v} photoUrl={photoFor(opts, v, r.target.colorId)} layers={layersFor(opts, r.decorations, v)} label={opts.views.find((x) => x.id === v)?.name ?? ""} className="w-24 border border-gray-200" />)
                  : <div className="h-24 w-24 rounded bg-gray-100" />}
              </div>
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <div className="font-medium">
                  {r.target.label || opts?.name}
                  {mode === "add" && opts && <span className="font-normal text-gray-500"> · {opts.colors.find((c) => c.id === r.target.colorId)?.name}</span>}
                </div>
                {r.error ? (
                  <p className="text-xs text-red-700">{r.error}</p>
                ) : (
                  <ul className="space-y-0.5 text-xs">
                    {r.entries.map((e) => {
                      const key = k2(r.target.key, e.loc);
                      return (
                        <li key={e.loc} className="flex flex-wrap items-center gap-x-2">
                          <span className={e.decoration ? "text-gray-700" : "text-amber-800"}>
                            {e.decoration ? `${e.decoration.location}: ${e.decoration.widthIn}″ × ${e.decoration.heightIn}″` : e.loc}
                            {e.decoration && e.decoration.stitches && opts?.methods.find((m) => m.id === e.decoration!.methodId)?.pricingModel === "PER_STITCH" ? ` · ~${Number(e.decoration.stitches).toLocaleString()} stitches` : ""}
                            {e.note ? ` (${e.note})` : ""}
                          </span>
                          {opts && !tuned[key] && (
                            <select className="rounded border border-gray-200 px-1 text-[11px]" value={picks[key] ?? ""} aria-label={`Area for ${e.loc}`} onChange={(ev) => setPicks({ ...picks, [key]: ev.target.value })}>
                              <option value="">{e.decoration || !picks[key] ? "auto" : "choose…"}</option>
                              {opts.areas.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                              <option value="skip">skip</option>
                            </select>
                          )}
                          {e.decoration && (
                            <button type="button" className="text-amber-700 hover:underline" onClick={() => setStudio({ kind: "tune", targetKey: r.target.key, loc: e.loc })}>Fine-tune</button>
                          )}
                          {tuned[key] && (
                            <button type="button" className="text-gray-500 hover:underline" onClick={() => setTuned((all) => Object.fromEntries(Object.entries(all).filter(([k]) => k !== key)))}>Undo</button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {!r.error && (
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    {r.target.currentTotal && <span className="text-xs text-gray-500">Now {money(r.target.currentTotal)} →</span>}
                    <PriceSummary price={prices.get(r.target.key)} loading={loading} compact />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ActionForm action={mode === "add" ? addLinesAction : updateLinesAction} onSaved={reset} submitLabel={mode === "add" ? `Add ${ready.length} item${ready.length === 1 ? "" : "s"}` : `Update ${ready.length} item${ready.length === 1 ? "" : "s"}`}>
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="lines" value={payload} />
        <div className="flex flex-wrap gap-3 text-sm">
          <button type="button" className="btn-secondary" onClick={() => setStudio({ kind: "design" })}>Change the design</button>
          <button type="button" className="text-gray-600 hover:underline" onClick={() => { setStep("items"); setDesign(null); setTuned({}); setPicks({}); }}>Back to the items</button>
          {results.length > ready.length && <span className="self-center text-xs text-amber-800">{results.length - ready.length} item{results.length - ready.length === 1 ? "" : "s"} can&apos;t take it and will be left out.</span>}
        </div>
      </ActionForm>
    </div>
  );

  // ─── The designer ─────────────────────────────────────────────────────────
  let studioEl = null;
  if (studio && first && firstOpts) {
    const tuning = studio.kind === "tune" ? results.find((r) => r.target.key === studio.targetKey) : null;
    const t = tuning?.target ?? first;
    const opts = tuning?.opts ?? firstOpts;
    const editing =
      studio.kind === "tune"
        ? (tuning?.entries.find((e) => e.loc === studio.loc)?.decoration ?? null)
        : design?.source ?? (adjusting ? (first.base.find((d) => locationKey(d.location) === locationKey(adjustLoc)) ?? null) : null);
    const around = (tuning?.decorations ?? t.base).filter((d) => d !== editing && !(editing && locationKey(d.location) === locationKey(editing.location)));
    const others: StudioOther[] = around.flatMap((d) => (d.artwork && d.artworkUrl && d.areaId ? [{ areaId: d.areaId, src: d.artworkUrl, art: d.artwork }] : []));
    studioEl = (
      <DesignStudio
        key={studio.kind === "tune" ? `${studio.targetKey}-${studio.loc}` : "design"}
        decoration={editing}
        methods={opts.methods}
        areas={opts.areas}
        views={opts.views}
        colors={opts.colors}
        colorId={t.colorId}
        others={others}
        productName={opts.name}
        owner={artOwner}
        ownerName={artOwner.name}
        guides={opts.guides}
        orderId={orderId}
        pricing={{ orderId, lineId: t.lineId, productId: t.productId, quantities: t.quantities, otherDecorations: around, replacesLocation: true }}
        saveLabel={studio.kind === "tune" ? "Use for this item" : `Place on ${targets.length} item${targets.length === 1 ? "" : "s"} →`}
        banner={
          studio.kind === "tune"
            ? <>Fine-tuning <b>{t.label || opts.name}</b> only. The other items keep their placement.</>
            : <>Designing on <b>{t.label || opts.name}</b>. Next it&apos;s placed on all {targets.length} item{targets.length === 1 ? "" : "s"} at the locations you choose, sized for each.</>
        }
        onClose={() => setStudio(null)}
        onSave={(d) => {
          if (studio.kind === "tune") {
            setTuned({ ...tuned, [k2(studio.targetKey, studio.loc)]: d });
          } else {
            setDesign({ source: d, sourceAreaId: d.areaId || null, designedOn: d.location });
            // The designed location first; keep other locations already chosen.
            setLocations((ls) => (adjusting ? [d.location] : [d.location, ...ls.filter((l) => locationKey(l) !== locationKey(d.location) && locationKey(l) !== locationKey(design?.designedOn ?? ""))]));
            setTuned({});
            setStep("place");
          }
          setStudio(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-3" data-testid={mode === "add" ? "bulk-add" : "bulk-update"}>
      {done && step === "items" && <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-800" role="status">{done}</p>}
      {step === "items" ? itemsStep : placeStep}
      {studioEl}
    </div>
  );
}
