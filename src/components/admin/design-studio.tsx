"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Mockup } from "@/components/mockup";
import { type ArtworkValue, PLACEABLE, PLACEABLE_ACCEPT, staffFileUrl } from "@/lib/design/artwork";
import { downscale, loadArt, rasterPreview, rasterToPng } from "@/lib/design/canvas";
import { type AreaBox, clampPlacement, dpiRating, effectiveDpi, fitPlacement, type Placement, photoRect, printSize } from "@/lib/design/placement";
import { applyEdits, type ArtEdits, palette, type Raster, removeBackground, trim } from "@/lib/design/raster";

export type StudioArea = AreaBox & { id: string; label: string };
export type StudioMethod = { name: string; pricingModel: string; minDpi: number | null; perfectDpi: number | null; maxColors: number | null };
export type StudioResult = { artwork: ArtworkValue; artworkUrl: string; inkColors: number; widthIn: number; heightIn: number };

const PREVIEW_PX = 900;
const RATING = {
  good: { text: "Great for printing", cls: "bg-green-50 text-green-800" },
  ok: { text: "OK for printing", cls: "bg-amber-50 text-amber-900" },
  low: { text: "Too low for a sharp print", cls: "bg-red-50 text-red-800" },
} as const;
const round2 = (n: number) => Math.round(n * 100) / 100;

type Loaded = { full: Raster; work: Raster; scale: number; file: File | null; sourceFileId: string | null; name: string };

/**
 * Place artwork on a print area: upload, clean up (background, colors),
 * then drag and size it on the product photo with live print size and
 * resolution. Saving uploads the edited PNG (and a new original).
 */
export function DesignStudio({
  area,
  photoUrl,
  method,
  productName,
  initial,
  onSave,
  onRemove,
  onClose,
}: {
  area: StudioArea;
  photoUrl: string | null;
  method?: StudioMethod;
  productName: string;
  initial: (ArtworkValue & { name?: string }) | null;
  onSave: (r: StudioResult) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [edits, setEdits] = useState<ArtEdits>(initial?.edits ?? {});
  const [place, setPlace] = useState<Placement | null>(initial ? { x: initial.x, y: initial.y, w: initial.w, rotation: initial.rotation } : null);
  const [busy, setBusy] = useState<string | null>(initial ? "Opening the artwork…" : null);
  const [error, setError] = useState<string | null>(null);
  const [artChanged, setArtChanged] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  // Reopen saved artwork from its original, so edits can be changed.
  useEffect(() => {
    if (!initial) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(staffFileUrl(initial.sourceFileId ?? initial.artworkFileId));
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        const art = await loadArt(blob, blob.type.includes("svg"));
        if (cancelled) return;
        setLoaded({ full: art.raster, work: downscale(art.raster, PREVIEW_PX), scale: art.scale, file: null, sourceFileId: initial.sourceFileId ?? initial.artworkFileId, name: initial.name ?? "artwork" });
      } catch {
        if (!cancelled) setError("The saved artwork couldn't be opened. Choose the file again.");
      } finally {
        if (!cancelled) setBusy(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initial]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Live preview on the smaller copy.
  const view = useMemo(() => {
    if (!loaded) return null;
    let base = loaded.work;
    if (edits.removeBg) base = removeBackground(base, edits.removeBg);
    if (edits.trim) base = trim(base);
    const colors = palette(base);
    const result = applyEdits(loaded.work, edits);
    const inks = edits.oneColor ? 1 : palette(result).length;
    // The finished art's size in original pixels, for the resolution check.
    const k = loaded.full.width / loaded.work.width / loaded.scale;
    return { colors, inks, preview: rasterPreview(result, PREVIEW_PX), art: { widthPx: Math.round(result.width * k), heightPx: Math.round(result.height * k) } };
  }, [loaded, edits]);

  // Keep the art inside the area when its shape changes (e.g. after trimming).
  const placed = view && place ? clampPlacement(area, place, view.art) : null;
  const size = view && placed ? printSize(area, placed, view.art) : null;
  const dpi = view && size ? effectiveDpi(view.art, size.widthIn) : 0;
  const rating = dpiRating(dpi, method ?? {});

  const choose = async (file: File | undefined) => {
    if (!file) return;
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    if (!PLACEABLE.includes(ext)) {
      setError("Choose a PNG, JPG, GIF, WebP or SVG to place it. PDF and Illustrator files can still be attached to the order under Files.");
      return;
    }
    setError(null);
    setBusy("Reading the artwork…");
    try {
      const art = await loadArt(file, ext === "svg");
      const work = downscale(art.raster, PREVIEW_PX);
      setLoaded({ full: art.raster, work, scale: art.scale, file, sourceFileId: null, name: file.name.replace(/\.[^.]+$/, "") });
      // A white or solid background is usually wanted gone; start with it removed for non-transparent art.
      const opaqueCorner = work.data[3] > 200;
      const startEdits: ArtEdits = opaqueCorner && ext !== "svg" ? { removeBg: { tolerance: 12 }, trim: true } : { trim: true };
      setEdits(startEdits);
      const first = applyEdits(work, startEdits);
      setPlace(fitPlacement(area, { widthPx: first.width, heightPx: first.height }));
      setArtChanged(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That file couldn't be read");
    } finally {
      setBusy(null);
    }
  };

  const edit = (patch: Partial<ArtEdits>) => {
    setEdits((e) => ({ ...e, ...patch }));
    setArtChanged(true);
  };

  const save = async () => {
    if (!loaded || !placed || !view || !size) return;
    setBusy("Saving…");
    setError(null);
    try {
      let artworkFileId = initial?.artworkFileId ?? "";
      let sourceFileId = loaded.sourceFileId;
      let { widthPx, heightPx } = view.art;
      if (artChanged || !initial) {
        const final = applyEdits(loaded.full, edits);
        if (!final.width || !final.height || final.width * final.height === 0) throw new Error("Nothing is left of the artwork; ease off the background removal");
        widthPx = Math.round(final.width / loaded.scale);
        heightPx = Math.round(final.height / loaded.scale);
        const body = new FormData();
        body.append("artwork", new File([await rasterToPng(final)], `${loaded.name}-placed.png`, { type: "image/png" }));
        if (loaded.file) body.append("source", loaded.file);
        const res = await fetch("/admin/api/artwork", { method: "POST", body });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "The artwork couldn't be saved");
        artworkFileId = json.artworkFileId;
        sourceFileId = json.sourceFileId ?? sourceFileId;
      }
      onSave({
        artwork: { artworkFileId, sourceFileId, edits, widthPx, heightPx, ...placed },
        artworkUrl: staffFileUrl(artworkFileId),
        inkColors: view.inks,
        widthIn: round2(size.widthIn),
        heightIn: round2(size.heightIn),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The artwork couldn't be saved");
      setBusy(null);
    }
  };

  // Drag to move; drag the corner to resize.
  const drag = (mode: "move" | "resize") => (e: React.PointerEvent) => {
    if (!placed || !stage.current || !view) return;
    e.preventDefault();
    e.stopPropagation();
    const box = stage.current.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, place: placed };
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.x) / box.width / area.w;
      const dy = (ev.clientY - start.y) / box.height / area.h;
      const next = mode === "move" ? { ...start.place, x: start.place.x + dx, y: start.place.y + dy } : { ...start.place, w: start.place.w + dx };
      setPlace(clampPlacement(area, next, view.art));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const rect = view && placed ? photoRect(area, placed, view.art) : null;
  const perColor = method?.pricingModel === "PER_COLOR";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-2 sm:p-6" role="dialog" aria-modal aria-label="Place artwork" data-testid="design-studio">
      <div className="w-full max-w-6xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h2 className="font-semibold">Place artwork</h2>
            <p className="text-xs text-gray-500">{productName} · {area.label} (up to {area.widthIn}″ × {area.heightIn}″){method ? ` · ${method.name}` : ""}</p>
          </div>
          <button type="button" className="text-gray-400 hover:text-gray-700" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="grid gap-5 p-4 md:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div ref={stage} className="relative mx-auto max-w-[560px]">
              <Mockup
                photoUrl={photoUrl}
                label={productName}
                outline={area}
                layers={view && rect ? [{ src: view.preview, left: rect.left, top: rect.top, width: rect.width, rotation: placed!.rotation }] : []}
              >
                {rect && (
                  <div
                    className="absolute cursor-move border border-amber-600/70 hover:bg-amber-200/10"
                    style={{ left: `${rect.left * 100}%`, top: `${rect.top * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%`, transform: placed!.rotation ? `rotate(${placed!.rotation}deg)` : undefined, touchAction: "none" }}
                    onPointerDown={drag("move")}
                    data-testid="art-handle"
                  >
                    <span
                      className="absolute -right-1.5 -bottom-1.5 h-3 w-3 cursor-nwse-resize rounded-sm border border-white bg-amber-600 shadow"
                      onPointerDown={drag("resize")}
                      data-testid="art-resize"
                    />
                  </div>
                )}
                {!loaded && !busy && (
                  <button type="button" className="absolute inset-0 m-auto h-fit w-fit btn" onClick={() => fileInput.current?.click()}>
                    📎 Choose artwork
                  </button>
                )}
              </Mockup>
            </div>
            <p className="mt-2 text-center text-xs text-gray-500">Drag the artwork to move it; drag its corner to resize. The dashed box is the print area.</p>
          </div>

          <div className="space-y-5 text-sm">
            <input ref={fileInput} type="file" accept={PLACEABLE_ACCEPT} className="sr-only" aria-label="Artwork file" onChange={(e) => choose(e.target.files?.[0])} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()}>
                📎 {loaded ? "Replace artwork" : "Choose artwork"}
              </button>
              {initial && (
                <button type="button" className="btn-danger" onClick={onRemove}>Remove artwork</button>
              )}
            </div>
            <p className="-mt-3 text-xs text-gray-500">PNG, JPG, GIF, WebP or SVG.</p>
            {busy && <p className="text-amber-800" role="status">{busy}</p>}
            {error && <p className="rounded bg-red-50 px-2 py-1 text-red-800" role="alert">{error}</p>}

            {view && placed && size && (
              <>
                <section className="space-y-2">
                  <h3 className="font-medium">Size &amp; position</h3>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600" htmlFor="st-width">Width</label>
                    <input
                      id="st-width"
                      className="input w-20"
                      inputMode="decimal"
                      key={round2(size.widthIn)}
                      defaultValue={round2(size.widthIn)}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v > 0) setPlace(clampPlacement(area, { ...placed, w: v / area.widthIn }, view.art));
                      }}
                    />
                    <span className="text-gray-600">× {round2(size.heightIn)} in</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => setPlace(fitPlacement(area, view.art))}>Fit to area</button>
                    <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => setPlace(clampPlacement(area, { ...placed, x: (1 - placed.w) / 2 }, view.art))}>Center across</button>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    Rotate
                    <input type="range" min={-45} max={45} value={placed.rotation > 180 ? placed.rotation - 360 : placed.rotation} onChange={(e) => setPlace({ ...placed, rotation: Number(e.target.value) })} className="flex-1" aria-label="Rotation" />
                    <span className="w-8 text-right">{Math.round(placed.rotation > 180 ? placed.rotation - 360 : placed.rotation)}°</span>
                  </label>
                  <p className={`rounded px-2 py-1 text-xs ${RATING[rating].cls}`} data-testid="dpi">
                    {Math.round(dpi)} DPI at this size: {RATING[rating].text}
                    {rating === "low" && ` (needs ${method?.minDpi ?? 150}+). Use a larger file or print it smaller.`}
                  </p>
                </section>

                <section className="space-y-2">
                  <h3 className="font-medium">Background</h3>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!edits.removeBg} onChange={(e) => edit({ removeBg: e.target.checked ? { tolerance: 12 } : undefined })} /> Remove background
                  </label>
                  {edits.removeBg && (
                    <>
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        Strength
                        <input type="range" min={0} max={60} value={edits.removeBg.tolerance} onChange={(e) => edit({ removeBg: { ...edits.removeBg!, tolerance: Number(e.target.value) } })} className="flex-1" aria-label="Background removal strength" />
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={!!edits.removeBg.everywhere} onChange={(e) => edit({ removeBg: { ...edits.removeBg!, everywhere: e.target.checked } })} /> Also inside the artwork (e.g. the middle of letters)
                      </label>
                    </>
                  )}
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!edits.trim} onChange={(e) => edit({ trim: e.target.checked })} /> Trim empty edges
                  </label>
                </section>

                <section className="space-y-2">
                  <h3 className="font-medium">
                    Colors <span className="font-normal text-gray-500" data-testid="ink-count">· {view.inks} {perColor ? "ink color" : "color"}{view.inks === 1 ? "" : "s"}{method?.maxColors && perColor && view.inks > method.maxColors ? ` (max ${method.maxColors})` : ""}</span>
                  </h3>
                  {!edits.oneColor && (
                    <div className="space-y-1" data-testid="palette">
                      {view.colors.map((c) => {
                        const to = edits.replace?.[c.hex];
                        return (
                          <div key={c.hex} className="flex items-center gap-2">
                            <span className="h-5 w-5 rounded border" style={{ background: c.hex }} />
                            <span className="w-16 font-mono text-xs">{c.hex}</span>
                            <span className="w-10 text-xs text-gray-500">{Math.round(c.share * 100)}%</span>
                            <span className="text-gray-400">→</span>
                            <input
                              type="color"
                              className="h-6 w-8 cursor-pointer rounded border"
                              value={(to ?? c.hex).toLowerCase()}
                              aria-label={`Change ${c.hex}`}
                              onChange={(e) => edit({ replace: { ...edits.replace, [c.hex]: e.target.value.toUpperCase() } })}
                            />
                            {to && (
                              <button type="button" className="text-xs text-amber-700 hover:underline" onClick={() => { const r = { ...edits.replace }; delete r[c.hex]; edit({ replace: r }); }}>
                                undo
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!edits.oneColor} onChange={(e) => edit({ oneColor: e.target.checked ? "#FFFFFF" : undefined })} /> Print in one color
                    {edits.oneColor && (
                      <input type="color" className="h-6 w-8 cursor-pointer rounded border" value={edits.oneColor.toLowerCase()} onChange={(e) => edit({ oneColor: e.target.value.toUpperCase() })} aria-label="Ink color" />
                    )}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!edits.invert} onChange={(e) => edit({ invert: e.target.checked })} /> Invert colors
                  </label>
                </section>
              </>
            )}

            <div className="flex gap-2 border-t border-gray-200 pt-4">
              <button type="button" className="btn" disabled={!view || !!busy} onClick={save}>Use this artwork</button>
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
