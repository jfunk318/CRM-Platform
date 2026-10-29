"use client";

import { useEffect, useState } from "react";
import type { OrderOptions } from "@/app/admin/api/products/[id]/order-options/route";
import { Mockup, type MockupLayer } from "@/components/mockup";
import { type ArtOwnerIds, enhanceLabel } from "@/lib/design/artwork";
import { photoRect } from "@/lib/design/placement";
import { type DecorationValue, DesignStudio } from "./design-studio";
import { ProductPicker, type PickedProduct } from "./product-picker";
import { ProductThumb } from "./product-thumb";
import { decorationForPrice, PriceSummary, quantitiesForPrice, useLivePrices } from "./live-price";

export type { DecorationValue } from "./design-studio";

const rosterCount = (text: string | undefined) => (text ?? "").split("\n").filter((l) => l.trim()).length;

export type LineValue = {
  productId: string;
  colorId: string;
  quantities: Record<string, string>;
  decorations: DecorationValue[];
  notes: string;
  /** Names and numbers, one piece per line ("L, Smith, 12"). */
  roster?: string;
};

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
  pricing,
}: {
  /** Live prices for a quote/order item: the order, and the line being edited (if any). */
  pricing?: { orderId: string; lineId?: string | null };
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

  const [studio, setStudio] = useState<number | "new" | null>(null);
  const color = options?.colors.find((c) => c.id === value.colorId);
  const { prices, loading: priceLoading } = useLivePrices(
    pricing?.orderId,
    pricing && options && value.colorId
      ? [{ key: "line", lineId: pricing.lineId, productId: value.productId, colorId: value.colorId, quantities: quantitiesForPrice(Object.fromEntries(Object.entries(value.quantities).filter(([id]) => color?.sizeIds.includes(id)))), decorations: value.decorations.filter((d) => d.methodId).map(decorationForPrice) }]
      : null,
  );

  // Pieces only count in sizes the chosen color comes in.
  const totalQty = Object.entries(value.quantities).reduce((n, [id, q]) => n + (color?.sizeIds.includes(id) ? Number(q) || 0 : 0), 0);
  const dropped = options && color ? options.sizes.filter((s) => Number(value.quantities[s.id]) > 0 && !color.sizeIds.includes(s.id)).map((s) => s.code) : [];

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
          <div className="space-y-2">
            <div className="label">Decorations</div>
            {value.decorations.length === 0 && <p className="text-sm text-gray-500">None. The item is sold blank.</p>}
            {value.decorations.map((d, i) => {
              const method = options.methods.find((m) => m.id === d.methodId);
              const facts = [
                method?.name ?? "No method",
                method?.pricingModel === "PER_COLOR" && d.colors ? `${d.colors} color${d.colors === "1" ? "" : "s"}` : null,
                method?.pricingModel === "PER_STITCH" && d.stitches ? `${Number(d.stitches).toLocaleString()} stitches` : null,
                d.widthIn && d.heightIn ? `${d.widthIn}″ × ${d.heightIn}″` : null,
                d.inkColors || null,
                d.needsArtwork ? "needs artwork" : null,
                d.needsDigitizing ? "needs digitizing" : null,
                d.reuseScreens ? "reuse screens" : null,
                enhanceLabel(d.artwork?.edits),
              ].filter(Boolean);
              return (
                <div key={i} className="flex items-center gap-3 rounded-md border border-gray-200 p-2" data-testid="decoration">
                  {/* Everything the designer set, for the form; names repeat per decoration, aligned by position. */}
                  <input type="hidden" name="d_method" value={d.methodId} />
                  <input type="hidden" name="d_area" value={d.areaId} />
                  <input type="hidden" name="d_location" value={d.location} />
                  <input type="hidden" name="d_colors" value={method?.pricingModel === "PER_COLOR" ? d.colors : ""} />
                  <input type="hidden" name="d_stitches" value={method?.pricingModel === "PER_STITCH" ? d.stitches : ""} />
                  <input type="hidden" name="d_w" value={d.widthIn} />
                  <input type="hidden" name="d_h" value={d.heightIn} />
                  <input type="hidden" name="d_inks" value={d.inkColors} />
                  <input type="hidden" name="d_art" value={d.needsArtwork ? "on" : ""} />
                  <input type="hidden" name="d_dig" value={d.needsDigitizing ? "on" : ""} />
                  <input type="hidden" name="d_reuse" value={d.reuseScreens ? "on" : ""} />
                  <input type="hidden" name="d_stitches_set" value={d.stitchesSet ? "on" : ""} />
                  <input type="hidden" name="d_artwork" value={d.artwork ? JSON.stringify(d.artwork) : ""} />
                  {d.artwork && d.artworkUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.artworkUrl} alt="" className="h-12 w-12 shrink-0 rounded border border-gray-200 bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)] bg-[length:10px_10px] object-contain" />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-dashed border-gray-300 text-[10px] text-gray-400">No art</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{d.location || "No location"}</div>
                    <div className="truncate text-xs text-gray-600">{facts.join(" · ")}</div>
                  </div>
                  <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => setStudio(i)}>Edit</button>
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => setValue((v) => ({ ...v, decorations: v.decorations.filter((_, j) => j !== i) }))}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
            <button type="button" className="btn-secondary" onClick={() => setStudio("new")} disabled={options.methods.length === 0}>
              + Add decoration
            </button>
            {options.methods.length === 0 && <p className="text-xs text-gray-500">No decoration methods are offered for this product.</p>}
          </div>

          {/* How many: one compact row of the sizes this color comes in, smallest to largest. */}
          <div data-testid="line-sizes">
            <div className="mb-1 flex items-baseline gap-2">
              <span className="text-sm font-medium text-gray-700">{sizeMode === "select" ? "Sizes to sell" : "Quantities"}</span>
              {sizeMode === "quantity" && totalQty > 0 && <span className="text-xs text-gray-500">{totalQty} piece{totalQty === 1 ? "" : "s"}</span>}
              {color && <span className="text-xs text-gray-400">· sizes {color.name} comes in</span>}
            </div>
            <div className="flex flex-wrap gap-1">
              {options.sizes
                .filter((s) => color?.sizeIds.includes(s.id))
                .map((s) =>
                  sizeMode === "select" ? (
                    <label key={s.id} className="flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-sm">
                      <input type="checkbox" name={`size_${s.id}`} defaultChecked /> {s.code}
                    </label>
                  ) : (
                    <label key={s.id} className={`flex w-12 flex-col overflow-hidden rounded border text-center ${Number(value.quantities[s.id]) > 0 ? "border-amber-400" : "border-gray-200"}`}>
                      <span className="bg-gray-50 py-0.5 text-[11px] font-medium text-gray-600">{s.code}</span>
                      <input
                        className="w-full px-1 py-1 text-center text-sm outline-none focus:bg-amber-50"
                        name={`qty_${s.id}`}
                        inputMode="numeric"
                        aria-label={`Quantity ${s.code}`}
                        value={value.quantities[s.id] ?? ""}
                        onChange={(e) => setValue((v) => ({ ...v, quantities: { ...v.quantities, [s.id]: e.target.value.replace(/[^\d]/g, "") } }))}
                      />
                    </label>
                  ),
                )}
            </div>
            {sizeMode === "quantity" && dropped.length > 0 && (
              <p className="mt-1 text-xs text-amber-800">{color?.name} doesn&apos;t come in {dropped.join(", ")}; those quantities won&apos;t be saved.</p>
            )}
          </div>

          {pricing && (
            <div className="rounded-md bg-gray-50 px-3 py-2" data-testid="line-price">
              <PriceSummary price={prices.get("line")} loading={priceLoading} />
            </div>
          )}

          {sizeMode === "quantity" && (
            <details className="rounded-md border border-gray-200 p-2" open={!!value.roster}>
              <summary className="cursor-pointer text-sm font-medium">
                Names &amp; numbers{" "}
                <span className="font-normal text-gray-500">
                  ({rosterCount(value.roster)} of {totalQty} piece{totalQty === 1 ? "" : "s"} named)
                </span>
              </summary>
              <textarea
                className="input mt-2 min-h-24 font-mono text-sm"
                name="roster"
                aria-label="Names and numbers"
                placeholder={"One piece per line: size, name, number\nL, Smith, 12\nXL, Garcia, 7\nM, 23"}
                value={value.roster ?? ""}
                onChange={(e) => setValue((v) => ({ ...v, roster: e.target.value }))}
              />
              <p className="text-xs text-gray-500">Printed as typed. Pieces without a name or number can be left off.</p>
            </details>
          )}

          <div>
            <label className="label" htmlFor="le-notes">Item notes</label>
            <input className="input" id="le-notes" name="notes" value={value.notes} onChange={(e) => setValue((v) => ({ ...v, notes: e.target.value }))} />
          </div>
        </>
      )}

      {studio !== null && options && (
        <DesignStudio
          // A fresh designer for each decoration opened.
          key={String(studio)}
          decoration={studio === "new" ? null : value.decorations[studio]}
          methods={options.methods}
          areas={options.areas}
          views={options.views}
          colors={options.colors}
          colorId={value.colorId}
          // The item's other placed artwork, shown on the views for context.
          others={value.decorations.flatMap((d, j) => (j !== studio && d.artwork && d.artworkUrl && areaOf(d) ? [{ areaId: d.areaId, src: d.artworkUrl, art: d.artwork }] : []))}
          productName={options.name}
          guides={options.guides}
          orderId={pricing?.orderId}
          pricing={
            pricing
              ? { orderId: pricing.orderId, lineId: pricing.lineId, productId: value.productId, quantities: value.quantities, otherDecorations: value.decorations.filter((_, j) => j !== studio) }
              : undefined
          }
          owner={artOwner ?? null}
          ownerName={artOwner?.name}
          onClose={() => setStudio(null)}
          onRemove={
            studio === "new"
              ? undefined
              : () => {
                  setValue((v) => ({ ...v, decorations: v.decorations.filter((_, j) => j !== studio) }));
                  setStudio(null);
                }
          }
          onSave={(d, colorId) => {
            setValue((v) => ({
              ...v,
              colorId,
              decorations: studio === "new" ? [...v.decorations, d] : v.decorations.map((x, j) => (j === studio ? d : x)),
            }));
            setStudio(null);
          }}
        />
      )}
    </div>
  );
}
