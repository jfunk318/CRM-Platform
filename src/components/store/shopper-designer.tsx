"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mockup, type MockupLayer } from "@/components/mockup";
import { downscale, loadArt, rasterPreview, rasterToPng } from "@/lib/design/canvas";
import { bestFit, coverageOf, guideFor } from "@/lib/design/guides";
import { clampPlacement, dpiRating, effectiveDpi, type Placement, photoRect, printSize } from "@/lib/design/placement";
import { applyEdits, palette, type Raster, trim } from "@/lib/design/raster";
import type { DesignerProduct } from "@/lib/store/designer";

/** Fonts for text, from Google Fonts. */
const FONTS: Record<string, string> = {
  Oswald: "Oswald:wght@700",
  "Bebas Neue": "Bebas+Neue",
  "Roboto Slab": "Roboto+Slab:wght@800",
  "Playfair Display": "Playfair+Display:wght@800",
  Pacifico: "Pacifico",
  "Permanent Marker": "Permanent+Marker",
  Inter: "Inter:wght@800",
};
const FONTS_URL = `https://fonts.googleapis.com/css2?${Object.values(FONTS).map((f) => `family=${f}`).join("&")}&display=swap`;
const PREVIEW_PX = 900;
const UPLOAD_TYPES = "image/png,image/jpeg,image/gif,image/webp,image/svg+xml,.svg";

type TextSpec = { content: string; font: string; color: string; outline: string | null };
type Art = {
  fileId: string;
  sourceFileId: string | null;
  preview: string;
  widthPx: number;
  heightPx: number;
  coverage: number;
  inks: number;
  text?: TextSpec;
};
type Deco = { methodId: string; art: Art; place: Placement };
type Price = { sizes: Record<string, string>; qty: number; example: boolean; total: string | null; minQty: number; stitches: (number | null)[]; error?: string };

const money = (v: string | number) => `$${Number(v).toFixed(2)}`;

async function upload(blob: Blob, name: string): Promise<string> {
  const body = new FormData();
  body.append("file", new File([blob], name, { type: blob.type || "image/png" }));
  const res = await fetch("/design/upload", { method: "POST", body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "The image couldn't be uploaded");
  return json.fileId as string;
}

/** Text drawn big on a transparent canvas (sharp at print size), trimmed to its ink. */
async function renderText(t: TextSpec): Promise<Raster> {
  await document.fonts.load(`700 100px "${t.font}"`);
  const lines = t.content.split("\n").map((l) => l.trimEnd()).filter((l, i, all) => l || i < all.length - 1);
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = `700 100px "${t.font}"`;
  // Sized so the widest line is ~3,600 px: 300 DPI even across a full 12″ back.
  const at100 = Math.max(1, ...lines.map((l) => measure.measureText(l || " ").width));
  // Short text (a number) gets bigger letters, within what a canvas can hold.
  const size = Math.round(Math.max(200, Math.min((100 * 3600) / at100, 7000 / (1.25 * lines.length + 0.4))));
  measure.font = `700 ${size}px "${t.font}"`;
  const pad = t.outline ? size / 6 : size / 12;
  const width = Math.ceil(Math.max(...lines.map((l) => measure.measureText(l || " ").width))) + pad * 2;
  const lineH = Math.round(size * 1.25);
  const height = lineH * lines.length + pad * 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(width, 8000);
  canvas.height = Math.min(height, 8000);
  const ctx = canvas.getContext("2d")!;
  ctx.font = `700 ${size}px "${t.font}"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((l, i) => {
    const y = pad + lineH * i + lineH / 2;
    if (t.outline) {
      ctx.lineJoin = "round";
      ctx.lineWidth = size / 8;
      ctx.strokeStyle = t.outline;
      ctx.strokeText(l, canvas.width / 2, y);
    }
    ctx.fillStyle = t.color;
    ctx.fillText(l, canvas.width / 2, y);
  });
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return trim({ data: data.data, width: canvas.width, height: canvas.height });
}

/** Facts about finished artwork pixels, for placing and pricing. */
function describe(r: Raster) {
  const small = downscale(r, PREVIEW_PX);
  return { preview: rasterPreview(small, PREVIEW_PX), coverage: coverageOf(small), inks: palette(small, { maxColors: 8 }).length };
}

/**
 * The shopper's designer: choose a color and where artwork goes, add an
 * image, text or one of the store's logos to each spot, drag and size it,
 * pick sizes, see the price, and add it to the cart.
 */
export function ShopperDesigner({
  product,
  can,
  library,
  showPrices,
  canBuy,
}: {
  product: DesignerProduct;
  can: { upload: boolean; text: boolean };
  library: { fileId: string; name: string; url: string }[];
  showPrices: boolean;
  canBuy: boolean;
}) {
  const firstArea = product.areas[0];
  const [colorId, setColorId] = useState(product.colors[0]?.id ?? "");
  const [areaId, setAreaId] = useState(firstArea?.id ?? "");
  const [decos, setDecos] = useState<Record<string, Deco>>({});
  const [methodId, setMethodId] = useState(product.methods[0]?.id ?? "");
  const [tab, setTab] = useState<"upload" | "text" | "library">(can.upload ? "upload" : can.text ? "text" : "library");
  const [text, setText] = useState<TextSpec>({ content: "", font: "Oswald", color: "#111111", outline: null });
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [lowResOk, setLowResOk] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState<Price | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const area = product.areas.find((a) => a.id === areaId) ?? firstArea;
  const viewId = area?.viewId ?? product.views[0]?.id;
  const color = product.colors.find((c) => c.id === colorId);
  const deco = area ? decos[area.id] : undefined;
  const method = product.methods.find((m) => m.id === (deco?.methodId ?? methodId));
  const photoOf = (v: string) => {
    const photos = product.views.find((x) => x.id === v)?.photos ?? {};
    return photos[colorId] ?? Object.values(photos)[0] ?? null;
  };
  const layersOn = (v: string): MockupLayer[] =>
    Object.entries(decos).flatMap(([aid, d]) => {
      const a = product.areas.find((x) => x.id === aid);
      if (!a || a.viewId !== v) return [];
      const r = photoRect(a, d.place, d.art);
      return [{ src: d.art.preview, left: r.left, top: r.top, width: r.width, rotation: d.place.rotation }];
    });
  const sizeOf = (aid: string, d: Deco) => {
    const a = product.areas.find((x) => x.id === aid)!;
    return printSize(a, d.place, d.art);
  };
  const lowRes = Object.entries(decos).filter(([aid, d]) => {
    const m = product.methods.find((x) => x.id === d.methodId);
    return dpiRating(effectiveDpi(d.art, sizeOf(aid, d).widthIn), m ?? {}) === "low";
  });

  // Put finished artwork on the current spot, sized by the placement guide.
  const place = (art: Art) => {
    if (!area) return;
    setDecos((all) => ({ ...all, [area.id]: { methodId: all[area.id]?.methodId ?? methodId, art, place: bestFit(area, art, product.guides) } }));
  };
  const run = async (label: string, fn: () => Promise<void>) => {
    setError(null);
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const fromFile = (file: File | undefined) =>
    file &&
    run("Preparing your artwork…", async () => {
      const vector = file.type.includes("svg") || file.name.toLowerCase().endsWith(".svg");
      const loaded = await loadArt(file, vector);
      // A solid background (a white box around a logo) usually isn't wanted.
      const opaque = loaded.raster.data[3] > 200;
      const finished = applyEdits(loaded.raster, opaque && !vector ? { removeBg: { tolerance: 14 }, trim: true } : { trim: true });
      if (!finished.width) throw new Error("Nothing's left of that image after removing its background");
      const png = await rasterToPng(finished);
      const fileId = await upload(png, `${file.name.replace(/\.[^.]+$/, "")}.png`);
      // The original too (not SVGs), so the shop can print from the best copy.
      const sourceFileId = !vector && /^image\/(png|jpeg|gif|webp)$/.test(file.type) ? await upload(file, file.name).catch(() => null) : null;
      place({ fileId, sourceFileId, ...describe(finished), widthPx: Math.round(finished.width / loaded.scale), heightPx: Math.round(finished.height / loaded.scale) });
    });

  const fromText = () =>
    text.content.trim() &&
    run("Setting your text…", async () => {
      const r = await renderText(text);
      const fileId = await upload(await rasterToPng(r), "text.png");
      place({ fileId, sourceFileId: null, ...describe(r), widthPx: r.width, heightPx: r.height, text: { ...text } });
    });

  const fromLibrary = (a: { fileId: string; url: string }) =>
    run("Opening the logo…", async () => {
      const res = await fetch(a.url);
      if (!res.ok) throw new Error("That logo couldn't be opened");
      const loaded = await loadArt(await res.blob(), false);
      place({ fileId: a.fileId, sourceFileId: null, ...describe(loaded.raster), widthPx: Math.round(loaded.raster.width / loaded.scale), heightPx: Math.round(loaded.raster.height / loaded.scale) });
    });

  // Drag to move, drag the corner to resize.
  const drag = (mode: "move" | "resize") => (e: React.PointerEvent) => {
    if (!deco || !area || !stage.current) return;
    e.preventDefault();
    e.stopPropagation();
    const box = stage.current.getBoundingClientRect();
    const from = { x: e.clientX, y: e.clientY, place: deco.place };
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - from.x) / box.width / area.w;
      const dy = (ev.clientY - from.y) / box.height / area.h;
      const next = mode === "move" ? { ...from.place, x: from.place.x + dx, y: from.place.y + dy } : { ...from.place, w: from.place.w + dx };
      setDecos((all) => ({ ...all, [area.id]: { ...all[area.id], place: clampPlacement(area, next, all[area.id].art) } }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Live price, a moment after each change.
  const priceBody = useMemo(
    () =>
      JSON.stringify({
        productId: product.id,
        colorId,
        quantities: Object.fromEntries(Object.entries(quantities).map(([k, v]) => [k, Number(v) || 0])),
        decorations: Object.entries(decos).map(([aid, d]) => {
          const s = sizeOf(aid, d);
          return { methodId: d.methodId, areaId: aid, widthIn: Math.round(s.widthIn * 100) / 100, heightIn: Math.round(s.heightIn * 100) / 100, colors: d.art.inks, coverage: d.art.coverage };
        }),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sizeOf reads the same state
    [product.id, colorId, quantities, decos],
  );
  useEffect(() => {
    if (!Object.keys(decos).length) {
      setPrice(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch("/design/price", { method: "POST", headers: { "Content-Type": "application/json" }, body: priceBody, signal: ctrl.signal })
        .then(async (r) => ({ ok: r.ok, json: await r.json() }))
        .then(({ ok, json }) => setPrice(ok ? json : { sizes: {}, qty: 0, example: true, total: null, minQty: json.minQty ?? 1, stitches: [], error: json.error }))
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [priceBody, decos]);

  const totalQty = Object.values(quantities).reduce((n, q) => n + (Number(q) || 0), 0);
  const addToCart = () =>
    run("Adding to your cart…", async () => {
      if (!Object.keys(decos).length) throw new Error("Add your artwork first");
      if (!totalQty) throw new Error("Enter how many of each size you'd like");
      if (lowRes.length && !lowResOk) throw new Error("Tick that you're OK with the low-resolution artwork, or make it smaller");
      const decorations = Object.entries(decos).map(([aid, d]) => {
        const a = product.areas.find((x) => x.id === aid)!;
        const s = sizeOf(aid, d);
        return {
          methodId: d.methodId,
          areaId: aid,
          location: a.label,
          colors: String(d.art.inks),
          stitches: "",
          widthIn: String(Math.round(s.widthIn * 100) / 100),
          heightIn: String(Math.round(s.heightIn * 100) / 100),
          inkColors: "",
          needsArtwork: false,
          needsDigitizing: false,
          reuseScreens: false,
          artwork: { artworkFileId: d.art.fileId, sourceFileId: d.art.sourceFileId, edits: d.art.text ? { text: d.art.text } : {}, widthPx: d.art.widthPx, heightPx: d.art.heightPx, ...d.place, coverage: d.art.coverage },
        };
      });
      const res = await fetch("/design/cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: product.id, colorId, quantities, decorations, lowResOk }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Your design couldn't be added");
      window.location.href = "/cart";
    });

  const rect = deco && area ? photoRect(area, deco.place, deco.art) : null;
  const decoSize = deco && area ? sizeOf(area.id, deco) : null;
  const guide = area ? guideFor(area.label, product.guides) : null;
  const decoIndex = deco ? Object.keys(decos).indexOf(area!.id) : -1;
  const stitches = decoIndex >= 0 ? price?.stitches?.[decoIndex] : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]" data-testid="shopper-designer">
      <link rel="stylesheet" href={FONTS_URL} precedence="default" />
      <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <div ref={stage} className="relative mx-auto max-w-[620px]">
          <Mockup photoUrl={viewId ? photoOf(viewId) : null} label={product.name} outline={area ?? null} layers={viewId ? layersOn(viewId) : []}>
            {rect && (
              <div
                className="absolute cursor-move border border-dashed border-[var(--accent)]"
                style={{ left: `${rect.left * 100}%`, top: `${rect.top * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%`, touchAction: "none" }}
                onPointerDown={drag("move")}
                data-testid="shopper-art"
              >
                <span className="absolute -right-2 -bottom-2 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-[var(--accent)] shadow" onPointerDown={drag("resize")} data-testid="shopper-resize" />
              </div>
            )}
          </Mockup>
        </div>
        {product.views.length > 1 && (
          <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Views">
            {product.views.map((v) => {
              const target = product.areas.find((a) => a.viewId === v.id);
              return (
                <button key={v.id} type="button" disabled={!target} onClick={() => target && setAreaId(target.id)} className={`w-20 rounded border p-0.5 text-center text-xs ${v.id === viewId ? "border-[var(--accent)]" : "border-[var(--st-border)]"}`} aria-pressed={v.id === viewId}>
                  <Mockup photoUrl={photoOf(v.id)} label={v.name} layers={layersOn(v.id)} />
                  {v.name}
                </button>
              );
            })}
          </div>
        )}
        <p className="text-center text-xs text-[var(--st-muted)]">Drag your artwork to move it; drag the round handle to resize. The dashed box is the print area.</p>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl">{product.name}</h1>
          {product.brand && <div className="text-sm text-[var(--st-muted)]">{product.brand}</div>}
        </div>

        <section className="space-y-2">
          <div className="text-sm font-semibold">Color: <span className="font-normal">{color?.name}</span></div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Color">
            {product.colors.map((c) => (
              <button key={c.id} type="button" title={c.name} aria-label={c.name} aria-pressed={c.id === colorId} onClick={() => setColorId(c.id)} className={`h-7 w-7 rounded-full border ${c.id === colorId ? "ring-2 ring-[var(--accent)] ring-offset-2" : "border-[var(--st-border)]"}`} style={{ background: c.hex ?? "repeating-linear-gradient(45deg,#ddd 0 3px,#fff 3px 6px)" }} />
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <div className="text-sm font-semibold">Where</div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Print area">
            {product.areas.map((a) => (
              <button key={a.id} type="button" onClick={() => setAreaId(a.id)} aria-pressed={a.id === area?.id} className={`rounded-full border px-3 py-1 text-sm ${a.id === area?.id ? "border-[var(--accent)] bg-[var(--st-subtle)]" : "border-[var(--st-border)]"}`}>
                {decos[a.id] ? "✓ " : ""}{a.label}
              </button>
            ))}
          </div>
          {product.methods.length > 1 && (
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">Printed with</span>
              <select
                className="input"
                value={deco?.methodId ?? methodId}
                onChange={(e) => {
                  setMethodId(e.target.value);
                  if (deco && area) setDecos((all) => ({ ...all, [area.id]: { ...all[area.id], methodId: e.target.value } }));
                }}
                aria-label="Decoration method"
              >
                {product.methods.map((m) => <option key={m.id} value={m.id}>{m.name}{m.minQty > 1 ? ` (${m.minQty}+ pieces)` : ""}</option>)}
              </select>
            </label>
          )}
        </section>

        <section className="space-y-3 rounded-lg border border-[var(--st-border)] p-4" data-testid="shopper-add">
          <div className="flex gap-1 text-sm" role="tablist">
            {can.upload && <button type="button" role="tab" aria-selected={tab === "upload"} onClick={() => setTab("upload")} className={`rounded px-3 py-1 ${tab === "upload" ? "bg-[var(--st-subtle)] font-semibold" : ""}`}>Upload</button>}
            {can.text && <button type="button" role="tab" aria-selected={tab === "text"} onClick={() => setTab("text")} className={`rounded px-3 py-1 ${tab === "text" ? "bg-[var(--st-subtle)] font-semibold" : ""}`}>Text</button>}
            {library.length > 0 && <button type="button" role="tab" aria-selected={tab === "library"} onClick={() => setTab("library")} className={`rounded px-3 py-1 ${tab === "library" ? "bg-[var(--st-subtle)] font-semibold" : ""}`}>Our logos</button>}
          </div>
          {tab === "upload" && can.upload && (
            <div className="space-y-2">
              <input ref={fileInput} type="file" accept={UPLOAD_TYPES} className="sr-only" aria-label="Your artwork" onChange={(e) => fromFile(e.target.files?.[0])} />
              <button type="button" className="st-btn" onClick={() => fileInput.current?.click()} disabled={!!busy}>{deco ? "Upload different artwork" : "Upload your artwork"}</button>
              <p className="text-xs text-[var(--st-muted)]">PNG, JPG, GIF, WebP or SVG. A plain background around a logo is removed for you.</p>
            </div>
          )}
          {tab === "text" && can.text && (
            <div className="space-y-2">
              <textarea className="input min-h-20" value={text.content} onChange={(e) => setText({ ...text, content: e.target.value })} placeholder="Your text" aria-label="Your text" maxLength={80} />
              <div className="grid grid-cols-2 gap-2">
                <select className="input" value={text.font} onChange={(e) => setText({ ...text, font: e.target.value })} aria-label="Font" style={{ fontFamily: `"${text.font}"` }}>
                  {Object.keys(FONTS).map((f) => <option key={f} value={f} style={{ fontFamily: `"${f}"` }}>{f}</option>)}
                </select>
                <div className="flex items-center gap-2 text-sm">
                  <input type="color" value={text.color} onChange={(e) => setText({ ...text, color: e.target.value })} aria-label="Text color" className="h-9 w-10 cursor-pointer rounded border border-[var(--st-border)]" />
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={!!text.outline} onChange={(e) => setText({ ...text, outline: e.target.checked ? "#ffffff" : null })} /> Outline
                  </label>
                  {text.outline && <input type="color" value={text.outline} onChange={(e) => setText({ ...text, outline: e.target.value })} aria-label="Outline color" className="h-9 w-10 cursor-pointer rounded border border-[var(--st-border)]" />}
                </div>
              </div>
              <button type="button" className="st-btn" onClick={fromText} disabled={!!busy || !text.content.trim()}>{deco?.art.text ? "Update text" : "Add text"}</button>
            </div>
          )}
          {tab === "library" && library.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {library.map((a) => (
                <button key={a.fileId} type="button" onClick={() => fromLibrary(a)} disabled={!!busy} title={a.name} className={`aspect-square overflow-hidden rounded border bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)] bg-[length:10px_10px] p-1 ${deco?.art.fileId === a.fileId ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-[var(--st-border)]"}`} data-testid="shopper-logo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt={a.name} className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          )}
          {busy && <p className="text-sm text-[var(--st-muted)]" role="status">{busy}</p>}

          {deco && area && decoSize && (
            <div className="space-y-2 border-t border-[var(--st-border)] pt-3 text-sm" data-testid="shopper-size">
              <div className="flex items-center gap-2">
                <span>Size</span>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.01}
                  value={deco.place.w}
                  onChange={(e) => setDecos((all) => ({ ...all, [area.id]: { ...deco, place: clampPlacement(area, { ...deco.place, w: Number(e.target.value) }, deco.art) } }))}
                  className="flex-1"
                  aria-label="Artwork size"
                />
                <span className="w-28 text-right" data-testid="shopper-inches">{decoSize.widthIn.toFixed(1)}″ × {decoSize.heightIn.toFixed(1)}″</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="st-btn-outline px-2 py-1 text-xs" onClick={() => setDecos((all) => ({ ...all, [area.id]: { ...deco, place: bestFit(area, deco.art, product.guides) } }))}>
                  {guide ? `Standard ${guide.name.toLowerCase()} size` : "Fit the area"}
                </button>
                <button type="button" className="st-btn-outline px-2 py-1 text-xs" onClick={() => setDecos((all) => ({ ...all, [area.id]: { ...deco, place: clampPlacement(area, { ...deco.place, x: (1 - deco.place.w) / 2 }, deco.art) } }))}>Center</button>
                <button type="button" className="px-2 py-1 text-xs text-red-600 hover:underline" onClick={() => setDecos((all) => Object.fromEntries(Object.entries(all).filter(([k]) => k !== area.id)))}>Remove</button>
              </div>
              <div className="text-xs text-[var(--st-muted)]">
                {method?.pricingModel === "PER_COLOR" && `${deco.art.inks} ink color${deco.art.inks === 1 ? "" : "s"}. `}
                {method?.pricingModel === "PER_STITCH" && stitches ? `About ${stitches.toLocaleString()} stitches. ` : ""}
                {dpiRating(effectiveDpi(deco.art, decoSize.widthIn), method ?? {}) === "low" && <span className="text-red-600">This image is low resolution at this size and may print blurry. </span>}
              </div>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <div className="text-sm font-semibold">Sizes</div>
          <div className="flex flex-wrap gap-2">
            {product.sizes.filter((s) => color?.sizeIds.includes(s.id)).map((s) => (
              <label key={s.id} className="w-16 text-center text-xs">
                <span className="block font-medium">{s.code}</span>
                <input className="input text-center" inputMode="numeric" value={quantities[s.id] ?? ""} onChange={(e) => setQuantities({ ...quantities, [s.id]: e.target.value.replace(/\D/g, "") })} aria-label={`How many ${s.code}`} />
                {showPrices && price?.sizes[s.id] && <span className="mt-0.5 block text-[var(--st-muted)]">{money(price.sizes[s.id])}</span>}
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-lg bg-[var(--st-subtle)] p-4" data-testid="shopper-price">
          {!Object.keys(decos).length ? (
            <p className="text-sm text-[var(--st-muted)]">Add your artwork to see the price.</p>
          ) : price?.error ? (
            <p className="text-sm text-red-600">{price.error}</p>
          ) : price && showPrices ? (
            price.example ? (
              <p className="text-sm">From <span className="text-lg font-semibold">{money(Math.min(...Object.values(price.sizes).map(Number)))}</span> each for {price.qty}+. Enter sizes for your total.</p>
            ) : (
              <p className="text-sm"><span className="text-2xl font-semibold" data-testid="shopper-total">{money(price.total ?? 0)}</span> for {totalQty} piece{totalQty === 1 ? "" : "s"}</p>
            )
          ) : (
            showPrices && <p className="text-sm text-[var(--st-muted)]">Working out the price…</p>
          )}
          {price && price.minQty > 1 && totalQty > 0 && totalQty < price.minQty && <p className="text-xs text-red-600">This needs at least {price.minQty} pieces.</p>}
          {lowRes.length > 0 && (
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" checked={lowResOk} onChange={(e) => setLowResOk(e.target.checked)} className="mt-0.5" />
              Some of my artwork is low resolution for its size. Print it anyway (it may look blurry).
            </label>
          )}
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <button type="button" className="st-btn w-full" onClick={addToCart} disabled={!!busy || !canBuy} data-testid="shopper-add-to-cart">
            Add to cart
          </button>
          <p className="text-xs text-[var(--st-muted)]">We check every design before printing and will contact you if anything needs fixing.</p>
        </section>
      </div>
    </div>
  );
}
