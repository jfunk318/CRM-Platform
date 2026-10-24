"use client";

import { useEffect, useState } from "react";
import type { OrderOptions } from "@/app/admin/api/products/[id]/order-options/route";
import { Mockup, type MockupLayer } from "@/components/mockup";
import type { ArtOwnerIds, ArtworkValue } from "@/lib/design/artwork";
import { photoRect } from "@/lib/design/placement";
import { DesignStudio } from "./design-studio";
import { ProductPicker, type PickedProduct } from "./product-picker";
import { ProductThumb } from "./product-thumb";

export type DecorationValue = {
  artwork: ArtworkValue | null;
  /** Where the placed artwork image can be loaded from. */
  artworkUrl: string | null;
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
  artwork: null,
  artworkUrl: null,
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
  product,
  initial,
  sizeMode = "quantity",
  artOwner,
}: {
  /** Whose artwork library the design studio shows (the order's customer, the store's owner). */
  artOwner?: ArtOwnerIds & { name: string };
  /** The product of `initial`, so its name shows before its options load. */
  product?: PickedProduct;
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

  const [studio, setStudio] = useState<number | null>(null);

  const color = options?.colors.find((c) => c.id === value.colorId);
  const setDecoration = (i: number, patch: Partial<DecorationValue>) =>
    setValue((v) => ({ ...v, decorations: v.decorations.map((d, j) => (j === i ? { ...d, ...patch } : d)) }));
  const totalQty = Object.values(value.quantities).reduce((n, q) => n + (Number(q) || 0), 0);

  // Mockups: each view's photo in the chosen color with every placed artwork on it.
  const areaOf = (d: DecorationValue) => options?.areas.find((a) => a.id === d.areaId);
  const photoFor = (viewId: string) => {
    const photos = options?.views.find((v) => v.id === viewId)?.photos ?? {};
    return photos[value.colorId] ?? Object.values(photos)[0] ?? null;
  };
  const layersFor = (viewId: string): MockupLayer[] =>
    value.decorations.flatMap((d) => {
      const a = areaOf(d);
      if (!a || a.viewId !== viewId || !d.artwork || !d.artworkUrl) return [];
      const r = photoRect(a, d.artwork, d.artwork);
      return [{ src: d.artworkUrl, left: r.left, top: r.top, width: r.width, rotation: d.artwork.rotation }];
    });
  const mockupViews = [...new Set(value.decorations.filter((d) => d.artwork).map((d) => areaOf(d)?.viewId).filter((v): v is string => !!v))];
  const studioDecoration = studio === null ? null : value.decorations[studio];
  const studioArea = studioDecoration ? areaOf(studioDecoration) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        {mockupViews.length > 0 ? (
          <div className="flex shrink-0 gap-1" data-testid="line-mockups">
            {mockupViews.map((viewId) => (
              <Mockup key={viewId} photoUrl={photoFor(viewId)} layers={layersFor(viewId)} label={options?.views.find((v) => v.id === viewId)?.name ?? ""} className="w-24 border border-gray-200" />
            ))}
          </div>
        ) : (
          <ProductThumb url={color?.image} label={options?.styleCode ?? product?.styleCode ?? ""} size={72} />
        )}
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="le-product">Product</label>
            <ProductPicker
              id="le-product"
              name="productId"
              selected={options ? { id: options.id, name: options.name, styleCode: options.styleCode } : (product ?? null)}
              onChange={(p) => {
                if (p.id === value.productId) return;
                setOptions(null);
                setValue((v) => ({ ...v, productId: p.id }));
              }}
              required
            />
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
                  <input type="hidden" name="d_artwork" value={d.artwork ? JSON.stringify(d.artwork) : ""} />
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
                  <div className="flex flex-wrap items-center gap-3 rounded bg-gray-50 px-2 py-1.5" data-testid="decoration-artwork">
                    {d.artwork && d.artworkUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.artworkUrl} alt="Placed artwork" className="h-10 w-10 rounded border border-gray-200 bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)] bg-[length:10px_10px] object-contain" />
                    ) : (
                      <span className="text-xs text-gray-500">No artwork placed</span>
                    )}
                    <button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={!areaOf(d)} onClick={() => setStudio(i)}>
                      {d.artwork ? "Edit artwork" : "🎨 Place artwork"}
                    </button>
                    {!areaOf(d) && <span className="text-xs text-gray-500">Choose a print area to place artwork.</span>}
                    {d.artwork && d.widthIn && d.heightIn && <span className="text-xs text-gray-600">{d.widthIn}″ × {d.heightIn}″</span>}
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

      {studio !== null && studioDecoration && studioArea && options && (
        <DesignStudio
          area={studioArea}
          photoUrl={photoFor(studioArea.viewId)}
          method={options.methods.find((m) => m.id === studioDecoration.methodId)}
          productName={`${options.name}${color ? ` · ${color.name}` : ""}`}
          owner={artOwner ?? null}
          ownerName={artOwner?.name}
          initial={studioDecoration.artwork}
          onClose={() => setStudio(null)}
          onRemove={() => {
            setDecoration(studio, { artwork: null, artworkUrl: null });
            setStudio(null);
          }}
          onSave={(r) => {
            const method = options.methods.find((m) => m.id === studioDecoration.methodId);
            setDecoration(studio, {
              artwork: r.artwork,
              artworkUrl: r.artworkUrl,
              widthIn: String(r.widthIn),
              heightIn: String(r.heightIn),
              needsArtwork: false,
              // Screen printing is priced by ink colors; fill in what the artwork uses.
              ...(method?.pricingModel === "PER_COLOR" ? { colors: String(r.inkColors) } : {}),
            });
            setStudio(null);
          }}
        />
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
