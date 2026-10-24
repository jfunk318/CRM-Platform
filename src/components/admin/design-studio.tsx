"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Mockup, type MockupLayer } from "@/components/mockup";
import { type ArtOwnerIds, type ArtworkValue, type LibraryArt, PLACEABLE, PLACEABLE_ACCEPT, staffFileUrl } from "@/lib/design/artwork";
import { cropPreview, downscale, loadArt, rasterPreview, rasterToPng, resizeToPng, svgToPng } from "@/lib/design/canvas";
import { PRINT_DPI, sizedSvg, suitsVector, targetWidthPx, traceToSvg } from "@/lib/design/enhance";
import { type AreaBox, clampPlacement, dpiRating, effectiveDpi, fitPlacement, type Placement, photoRect, printSize } from "@/lib/design/placement";
import { applyEdits, type ArtEdits, MAX_PALETTE, palette, type Raster, removeBackground, trim } from "@/lib/design/raster";

export type StudioArea = AreaBox & { id: string; label: string; viewId: string };
export type StudioView = { id: string; name: string; photos: Record<string, string> };
export type StudioColor = { id: string; name: string; hex: string | null; image?: string | null };
/** Another decoration's placed artwork on the same item, shown for context. */
export type StudioOther = { areaId: string; src: string; art: ArtworkValue };
export type StudioMethod = { id: string; name: string; pricingModel: string; minQty: number; minDpi: number | null; perfectDpi: number | null; maxColors: number | null };

/** One decoration on a quote/order item, as the item editor and the designer hold it. */
export type DecorationValue = {
  artwork: ArtworkValue | null;
  /** Where the placed artwork image can be loaded from. */
  artworkUrl: string | null;
  methodId: string;
  /** A print area, or "" for a location typed in by hand. */
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

export const blankDecoration = (): DecorationValue => ({
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
  needsArtwork: true,
  needsDigitizing: false,
  reuseScreens: false,
});

const PREVIEW_PX = 900;
const RATING = {
  good: { text: "Great for printing", cls: "bg-green-50 text-green-800" },
  ok: { text: "OK for printing", cls: "bg-amber-50 text-amber-900" },
  low: { text: "Too low for a sharp print", cls: "bg-red-50 text-red-800" },
} as const;
const round2 = (n: number) => Math.round(n * 100) / 100;
const OTHER = "__other";

type Loaded = {
  full: Raster;
  work: Raster;
  scale: number;
  /** A new upload (saved as the original when the artwork is used). */
  file: File | null;
  sourceFileId: string | null;
  /** Picked from the customer's library. */
  libraryFileId: string | null;
  name: string;
};

/**
 * Add or edit a decoration: method, location (a print area on any view, or
 * one typed in), details, and the artwork: pick from the customer's library
 * or upload, clean it up, then drag and size it on the product photo with
 * live print size and resolution, on any garment color.
 */
export function DesignStudio({
  decoration,
  methods,
  areas,
  views,
  colors,
  colorId,
  others,
  productName,
  owner,
  ownerName,
  onSave,
  onRemove,
  onClose,
}: {
  /** The decoration being edited, or null to add one. */
  decoration: DecorationValue | null;
  methods: StudioMethod[];
  /** Every print area on the product (with the view it's on). */
  areas: StudioArea[];
  views: StudioView[];
  colors: StudioColor[];
  /** The item's garment color. */
  colorId: string;
  others: StudioOther[];
  productName: string;
  /** Whose artwork library to show and file new uploads under. */
  owner: ArtOwnerIds | null;
  ownerName?: string;
  /** The finished decoration and the item's (possibly changed) garment color. */
  onSave: (d: DecorationValue, colorId: string) => void;
  /** Remove the decoration (editing only). */
  onRemove?: () => void;
  onClose: () => void;
}) {
  // What the designer opened with; artwork in it is reloaded from its original.
  const [start] = useState<DecorationValue>(() => decoration ?? { ...blankDecoration(), methodId: methods[0]?.id ?? "", areaId: areas[0]?.id ?? "", location: areas[0]?.label ?? "" });
  const initial = start.artwork;

  const [methodId, setMethodId] = useState(start.methodId || methods[0]?.id || "");
  const [areaId, setAreaId] = useState<string>(start.areaId || (decoration ? OTHER : (areas[0]?.id ?? OTHER)));
  const [otherName, setOtherName] = useState(start.areaId ? "" : start.location);
  const [details, setDetails] = useState({
    colors: start.colors,
    stitches: start.stitches,
    inkColors: start.inkColors,
    widthIn: start.widthIn,
    heightIn: start.heightIn,
    needsArtwork: start.needsArtwork,
    needsDigitizing: start.needsDigitizing,
    reuseScreens: start.reuseScreens,
  });
  // Ink colors follow the artwork until typed over.
  const [colorsTyped, setColorsTyped] = useState(false);

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [edits, setEdits] = useState<ArtEdits>(initial?.edits ?? {});
  const [place, setPlace] = useState<Placement | null>(initial ? { x: initial.x, y: initial.y, w: initial.w, rotation: initial.rotation } : null);
  const [busy, setBusy] = useState<string | null>(initial ? "Opening the artwork…" : null);
  const [error, setError] = useState<string | null>(null);
  const [artChanged, setArtChanged] = useState(false);
  const [library, setLibrary] = useState<LibraryArt[] | null>(null);
  // The gallery shows first for new artwork; editing saved artwork goes straight to the tools.
  const [picking, setPicking] = useState(!initial);
  const [filter, setFilter] = useState("");
  const [previewColorId, setPreviewColorId] = useState(colorId);
  const [itemColorId, setItemColorId] = useState(colorId);
  // Enhance for print: the comparison panel, and the traced vector for the current edits.
  const [enhancing, setEnhancing] = useState<null | { flat: boolean; method: "vector" | "resize"; before: string; vector: string | null; resized: string }>(null);
  const [traced, setTraced] = useState<{ key: string; svg: string; width: number; height: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  const method = methods.find((m) => m.id === methodId);
  const perColor = method?.pricingModel === "PER_COLOR";
  const perStitch = method?.pricingModel === "PER_STITCH";
  const area = areaId === OTHER ? undefined : areas.find((a) => a.id === areaId);
  const stageViewId = area?.viewId ?? views.find((v) => Object.keys(v.photos).length)?.id ?? null;
  const areasOnView = area ? areas.filter((a) => a.viewId === area.viewId) : [];
  const viewName = (id: string) => views.find((v) => v.id === id)?.name ?? "";
  // A view's photo in the color being previewed (falling back to the item's color).
  const photoOf = (viewId: string | null) => {
    const photos = views.find((v) => v.id === viewId)?.photos ?? {};
    return photos[previewColorId] ?? photos[colorId] ?? Object.values(photos)[0] ?? colors.find((c) => c.id === previewColorId)?.image ?? null;
  };
  const otherLayers = (viewId: string | null): MockupLayer[] =>
    others.flatMap((o) => {
      const a = areas.find((x) => x.id === o.areaId);
      if (!a || a.viewId !== viewId) return [];
      const r = photoRect(a, o.art, o.art);
      return [{ src: o.src, left: r.left, top: r.top, width: r.width, rotation: o.art.rotation }];
    });
  const previewColor = colors.find((c) => c.id === previewColorId);
  const itemColor = colors.find((c) => c.id === itemColorId);

  useEffect(() => {
    if (!owner?.customerId && !owner?.companyId) {
      setLibrary([]);
      return;
    }
    let cancelled = false;
    const qs = new URLSearchParams({ customerId: owner.customerId ?? "", companyId: owner.companyId ?? "" });
    fetch(`/admin/api/artwork?${qs}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: LibraryArt[]) => !cancelled && setLibrary(list))
      .catch(() => !cancelled && setLibrary([]));
    return () => {
      cancelled = true;
    };
  }, [owner?.customerId, owner?.companyId]);

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
        setLoaded({
          full: art.raster,
          work: downscale(art.raster, PREVIEW_PX),
          scale: art.scale,
          file: null,
          sourceFileId: initial.sourceFileId ?? initial.artworkFileId,
          libraryFileId: null,
          name: "artwork",
        });
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
    // At most 8 colors (or the chosen limit): more never print as separate inks.
    const limit = edits.reduce ?? MAX_PALETTE;
    const palColors = palette(base, { maxColors: limit });
    const result = applyEdits(loaded.work, edits);
    const inks = edits.oneColor ? 1 : palette(result, { maxColors: limit }).length;
    // The finished art's size in original pixels, for the resolution check.
    const k = loaded.full.width / loaded.work.width / loaded.scale;
    return { colors: palColors, inks, preview: rasterPreview(result, PREVIEW_PX), art: { widthPx: Math.round(result.width * k), heightPx: Math.round(result.height * k) } };
  }, [loaded, edits]);

  // Keep the art inside the area when its shape changes (e.g. after trimming) or the area does.
  const placed = view && place && area ? clampPlacement(area, place, view.art) : null;
  const size = view && placed && area ? printSize(area, placed, view.art) : null;
  // The art's own resolution at this size; enhancing brings the print file to 300 DPI.
  const rawDpi = view && size ? effectiveDpi(view.art, size.widthIn) : 0;
  const enhance = edits.enhance;
  const dpi = enhance ? Math.max(rawDpi, PRINT_DPI) : rawDpi;
  const rating = enhance?.method === "resize" ? "ok" : dpiRating(dpi, method ?? {});
  const inkCount = colorsTyped || !view ? details.colors : String(view.inks);
  // Which edits a traced vector was made from (it's redone if they change).
  const editsKey = JSON.stringify({ ...edits, enhance: undefined });
  const tracedNow = traced?.key === editsKey ? traced : null;
  const tracedSrc = useMemo(() => (tracedNow ? `data:image/svg+xml;utf8,${encodeURIComponent(tracedNow.svg)}` : null), [tracedNow]);

  /** Compare a close-up of the art as it is with vector and enlarged versions. */
  const openEnhance = async () => {
    if (!loaded) return;
    setBusy("Preparing a close-up…");
    await new Promise((r) => setTimeout(r, 30)); // let the message show before the heavy work
    try {
      const final = applyEdits(loaded.full, { ...edits, enhance: undefined });
      const flat = suitsVector(final);
      const src = downscale(final, 2000);
      const svg = traceToSvg(src);
      setTraced({ key: editsKey, svg, width: src.width, height: src.height });
      // A close-up of the middle of the art.
      const region = { x: 0.35, y: 0.35, w: 0.3, h: 0.3 };
      const crop = cropPreview(final, region);
      const vb = `${region.x * src.width} ${region.y * src.height} ${region.w * src.width} ${region.h * src.height}`;
      const zoomed = svg.replace(/viewBox="[^"]*"/, `viewBox="${vb}"`);
      setEnhancing({ flat, method: flat ? "vector" : "resize", before: crop, vector: `data:image/svg+xml;utf8,${encodeURIComponent(zoomed)}`, resized: crop });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The artwork couldn't be enhanced");
    } finally {
      setBusy(null);
    }
  };

  /** Start placing art from a new upload or the library: fit it to the area with sensible clean-up. */
  const begin = async (src: Blob, o: { name: string; ext: string; file: File | null; libraryFileId: string | null }) => {
    if (!area) return;
    setError(null);
    setBusy("Reading the artwork…");
    try {
      const vector = o.ext === "svg" || src.type.includes("svg");
      const art = await loadArt(src, vector);
      const work = downscale(art.raster, PREVIEW_PX);
      setLoaded({ full: art.raster, work, scale: art.scale, file: o.file, sourceFileId: o.libraryFileId, libraryFileId: o.libraryFileId, name: o.name.replace(/\.[^.]+$/, "") });
      // A white or solid background is usually wanted gone; start with it removed for non-transparent art.
      const opaqueCorner = work.data[3] > 200;
      const startEdits: ArtEdits = opaqueCorner && !vector ? { removeBg: { tolerance: 12 }, trim: true } : { trim: true };
      setEdits(startEdits);
      const first = applyEdits(work, startEdits);
      setPlace(fitPlacement(area, { widthPx: first.width, heightPx: first.height }));
      setArtChanged(true);
      setPicking(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That file couldn't be read");
    } finally {
      setBusy(null);
    }
  };

  const choose = async (file: File | undefined) => {
    if (!file) return;
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    if (!PLACEABLE.includes(ext)) {
      setError("Choose a PNG, JPG, GIF, WebP or SVG to place it. PDF and Illustrator files can still be attached to the order under Files.");
      return;
    }
    await begin(file, { name: file.name, ext, file, libraryFileId: null });
  };

  const pick = async (art: LibraryArt) => {
    setBusy("Opening the artwork…");
    try {
      const res = await fetch(staffFileUrl(art.fileId));
      if (!res.ok) throw new Error("That artwork couldn't be opened");
      await begin(await res.blob(), { name: art.name, ext: art.name.toLowerCase().split(".").pop() ?? "", file: null, libraryFileId: art.fileId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "That artwork couldn't be opened");
      setBusy(null);
    }
  };

  const removeArt = () => {
    setLoaded(null);
    setPlace(null);
    setEdits({});
    setArtChanged(true);
    setPicking(true);
    setDetails((d) => ({ ...d, needsArtwork: true }));
  };

  const edit = (patch: Partial<ArtEdits>) => {
    setEdits((e) => ({ ...e, ...patch }));
    setArtChanged(true);
  };

  const save = async () => {
    setError(null);
    if (!method) return setError("Choose a decoration method");
    const location = area ? area.label : otherName.trim();
    if (!location) return setError("Name the location, e.g. Left Sleeve");
    setBusy("Saving…");
    try {
      let artwork: ArtworkValue | null = null;
      let artworkUrl: string | null = null;
      let widthIn = details.widthIn;
      let heightIn = details.heightIn;
      if (loaded && placed && view && size) {
        let artworkFileId = initial?.artworkFileId ?? "";
        let sourceFileId = loaded.sourceFileId;
        let { widthPx, heightPx } = view.art;
        let savedEdits: ArtEdits = edits;
        // An enhanced print file is made for the placed size, so it's redone if the art was made bigger.
        const target = targetWidthPx(size.widthIn);
        const tooSmall = !!enhance && (initial?.widthPx ?? 0) < target - 2;
        if (artChanged || !initial || tooSmall) {
          const final = applyEdits(loaded.full, edits);
          if (!final.width || !final.height) throw new Error("Nothing is left of the artwork; ease off the background removal");
          widthPx = Math.round(final.width / loaded.scale);
          heightPx = Math.round(final.height / loaded.scale);
          let png: Blob;
          let vectorSvg: string | null = null;
          if (enhance) {
            setBusy(enhance.method === "vector" ? "Tracing and drawing at 300 DPI…" : "Enlarging to 300 DPI…");
            widthPx = target;
            heightPx = Math.max(1, Math.round((target * final.height) / final.width));
            if (enhance.method === "vector") {
              const t = tracedNow ?? (() => {
                const src = downscale(final, 2000);
                return { svg: traceToSvg(src), width: src.width, height: src.height };
              })();
              vectorSvg = sizedSvg(t.svg, t.width, t.height);
              png = await svgToPng(sizedSvg(t.svg, widthPx, heightPx), widthPx, heightPx);
            } else {
              png = await resizeToPng(final, widthPx, heightPx);
            }
          } else {
            png = await rasterToPng(final);
          }
          const body = new FormData();
          body.append("artwork", new File([png], `${loaded.name}-placed.png`, { type: "image/png" }));
          if (vectorSvg) body.append("vector", new File([vectorSvg], `${loaded.name}-vector.svg`, { type: "image/svg+xml" }));
          if (loaded.file) {
            body.append("source", loaded.file);
            // New uploads go into the customer's library.
            body.append("customerId", owner?.customerId ?? "");
            body.append("companyId", owner?.companyId ?? "");
          }
          if (loaded.libraryFileId) body.append("libraryFileId", loaded.libraryFileId);
          const res = await fetch("/admin/api/artwork", { method: "POST", body });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "The artwork couldn't be saved");
          artworkFileId = json.artworkFileId;
          sourceFileId = json.sourceFileId ?? sourceFileId;
          // Record how it was brought up to print resolution (and where the vector file is).
          if (enhance) savedEdits = { ...edits, enhance: { method: enhance.method, fromDpi: Math.round(rawDpi), ...(json.vectorFileId ? { vectorFileId: json.vectorFileId } : {}) } };
        }
        artwork = { artworkFileId, sourceFileId, edits: savedEdits, widthPx, heightPx, ...placed };
        artworkUrl = staffFileUrl(artworkFileId);
        widthIn = String(round2(size.widthIn));
        heightIn = String(round2(size.heightIn));
      }
      onSave(
        {
          ...details,
          methodId,
          areaId: area?.id ?? "",
          location,
          artwork,
          artworkUrl,
          widthIn,
          heightIn,
          colors: perColor ? inkCount : details.colors,
          needsArtwork: artwork ? false : details.needsArtwork,
        },
        itemColorId,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "The decoration couldn't be saved");
      setBusy(null);
    }
  };

  // Drag to move; drag the corner to resize.
  const drag = (mode: "move" | "resize") => (e: React.PointerEvent) => {
    if (!placed || !stage.current || !view || !area) return;
    e.preventDefault();
    e.stopPropagation();
    const box = stage.current.getBoundingClientRect();
    const from = { x: e.clientX, y: e.clientY, place: placed };
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - from.x) / box.width / area.w;
      const dy = (ev.clientY - from.y) / box.height / area.h;
      const next = mode === "move" ? { ...from.place, x: from.place.x + dx, y: from.place.y + dy } : { ...from.place, w: from.place.w + dx };
      setPlace(clampPlacement(area, next, view.art));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const rect = view && placed && area ? photoRect(area, placed, view.art) : null;
  // With vector enhancement on, the mockup shows the traced artwork.
  const artSrc = enhance?.method === "vector" && tracedSrc ? tracedSrc : view?.preview;
  const currentLayer = view && rect && artSrc ? [{ src: artSrc, left: rect.left, top: rect.top, width: rect.width, rotation: placed!.rotation }] : [];
  const setDetail = (patch: Partial<typeof details>) => setDetails((d) => ({ ...d, ...patch }));

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-2 sm:p-6" role="dialog" aria-modal aria-label="Decoration" data-testid="design-studio">
      <div className="w-full max-w-6xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h2 className="font-semibold">{decoration ? "Edit decoration" : "Add decoration"}</h2>
            <p className="text-xs text-gray-500" data-testid="studio-summary">
              {productName}
              {itemColor ? ` · ${itemColor.name}` : ""}
              {area ? ` · ${viewName(area.viewId)}: ${area.label.split(" / ").pop()} (up to ${area.widthIn}″ × ${area.heightIn}″)` : otherName ? ` · ${otherName}` : ""}
              {method ? ` · ${method.name}` : ""}
            </p>
          </div>
          <button type="button" className="text-gray-400 hover:text-gray-700" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="grid gap-5 p-4 md:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <div ref={stage} className="relative mx-auto max-w-[560px]">
              <Mockup photoUrl={photoOf(stageViewId)} label={productName} outline={area ?? null} layers={[...otherLayers(stageViewId), ...currentLayer]}>
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
                  <p className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded bg-white/85 px-3 py-2 text-center text-sm text-gray-700">
                    {area ? "Pick artwork on the right, or upload new." : "Choose a print area to place artwork, or save the decoration without it."}
                  </p>
                )}
              </Mockup>
            </div>
            {area && <p className="mt-2 text-center text-xs text-gray-500">Drag the artwork to move it; drag its corner to resize. The dashed box is the print area.</p>}

            {areasOnView.length > 1 && (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5" role="group" aria-label="Print area">
                {areasOnView.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`rounded-full border px-2.5 py-0.5 text-xs ${a.id === area?.id ? "border-amber-500 bg-amber-50 text-amber-900" : "border-gray-200 hover:border-amber-400"}`}
                    onClick={() => setAreaId(a.id)}
                  >
                    {a.label.split(" / ").pop()} <span className="text-gray-400">{a.widthIn}″×{a.heightIn}″</span>
                  </button>
                ))}
              </div>
            )}

            {/* Every view of the product: click one to decorate it. */}
            {views.length > 1 && (
              <div className="mt-3 flex flex-wrap justify-center gap-2" role="group" aria-label="Product views" data-testid="studio-views">
                {views.map((v) => {
                  const target = v.id === area?.viewId ? area : areas.find((a) => a.viewId === v.id);
                  const here = v.id === area?.viewId;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      className={`w-20 rounded border p-0.5 text-center text-[11px] ${here ? "border-amber-500 ring-1 ring-amber-500" : "border-gray-200 hover:border-amber-400"} disabled:cursor-not-allowed disabled:opacity-50`}
                      onClick={() => target && setAreaId(target.id)}
                      disabled={!target}
                      title={target ? `Decorate the ${v.name.toLowerCase()}` : `${v.name} has no print area (add one under the product's Views & Decoration Areas)`}
                      aria-pressed={here}
                    >
                      <Mockup photoUrl={photoOf(v.id)} label={v.name} layers={[...otherLayers(v.id), ...(here ? currentLayer : [])]} />
                      <span className="mt-0.5 block truncate">{v.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Garment colors: check how the artwork reads on each. */}
            {colors.length > 1 && (
              <div className="mt-3 space-y-1.5 text-center" data-testid="studio-colors">
                <div className="flex flex-wrap justify-center gap-1" role="group" aria-label="Garment color">
                  {colors.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`h-6 w-6 rounded-full border ${c.id === previewColorId ? "ring-2 ring-amber-500 ring-offset-1" : "border-gray-300 hover:ring-1 hover:ring-amber-400"}`}
                      // Colors without a known swatch are striped, so they don't pass for white.
                      style={{ background: c.hex ?? "repeating-linear-gradient(45deg, #e5e7eb 0 3px, #fff 3px 6px)" }}
                      title={c.name}
                      aria-label={c.name}
                      aria-pressed={c.id === previewColorId}
                      onClick={() => setPreviewColorId(c.id)}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-600">
                  Showing <span className="font-medium">{previewColor?.name}</span>
                  {previewColorId !== itemColorId ? (
                    <>
                      {" "}· item is {itemColor?.name}.{" "}
                      <button type="button" className="text-amber-700 hover:underline" onClick={() => setItemColorId(previewColorId)}>
                        Use {previewColor?.name} for this item
                      </button>
                    </>
                  ) : itemColorId !== colorId ? (
                    <> · the item will change to this color</>
                  ) : (
                    <> (the item&apos;s color)</>
                  )}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-5 text-sm">
            <section className="space-y-2" data-testid="decoration-details">
              <div className="grid gap-2">
                <div>
                  <label className="label" htmlFor="st-method">Method</label>
                  <select className="input" id="st-method" value={methodId} onChange={(e) => setMethodId(e.target.value)}>
                    {methods.length === 0 && <option value="">No methods set up</option>}
                    {methods.map((m) => <option key={m.id} value={m.id}>{m.name}{m.minQty > 1 ? ` (min ${m.minQty})` : ""}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="st-area">Location</label>
                  <select className="input" id="st-area" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                    {areas.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                    <option value={OTHER}>Other location…</option>
                  </select>
                </div>
              </div>
              {!area && (
                <input className="input" value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="Location name, e.g. Left Sleeve" aria-label="Location name" />
              )}
              <div className="grid grid-cols-2 gap-2">
                {perColor && (
                  <div>
                    <label className="label" htmlFor="st-colors">Ink colors{method?.maxColors ? ` (max ${method.maxColors})` : ""}</label>
                    <input
                      className="input"
                      id="st-colors"
                      inputMode="numeric"
                      value={inkCount}
                      onChange={(e) => {
                        setColorsTyped(true);
                        setDetail({ colors: e.target.value });
                      }}
                    />
                    {view && !colorsTyped && <p className="mt-0.5 text-[11px] text-gray-500">From the artwork</p>}
                  </div>
                )}
                {perStitch && (
                  <div>
                    <label className="label" htmlFor="st-stitches">Stitches</label>
                    <input className="input" id="st-stitches" inputMode="numeric" value={details.stitches} onChange={(e) => setDetail({ stitches: e.target.value })} />
                  </div>
                )}
                <div className={perColor || perStitch ? "" : "col-span-2"}>
                  <label className="label" htmlFor="st-inks">{perStitch ? "Thread colors" : "Ink colors (names)"}</label>
                  <input className="input" id="st-inks" value={details.inkColors} onChange={(e) => setDetail({ inkColors: e.target.value })} placeholder="White, PMS 186" />
                </div>
              </div>
              {!loaded && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label" htmlFor="st-w">Width (in)</label>
                    <input className="input" id="st-w" inputMode="decimal" value={details.widthIn} onChange={(e) => setDetail({ widthIn: e.target.value })} placeholder={area ? String(area.widthIn) : ""} />
                  </div>
                  <div>
                    <label className="label" htmlFor="st-h">Height (in)</label>
                    <input className="input" id="st-h" inputMode="decimal" value={details.heightIn} onChange={(e) => setDetail({ heightIn: e.target.value })} placeholder={area ? String(area.heightIn) : ""} />
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {!loaded && (
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={details.needsArtwork} onChange={(e) => setDetail({ needsArtwork: e.target.checked })} /> Needs artwork
                  </label>
                )}
                {perStitch && (
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={details.needsDigitizing} onChange={(e) => setDetail({ needsDigitizing: e.target.checked })} /> Needs digitizing
                  </label>
                )}
                {perColor && (
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={details.reuseScreens} onChange={(e) => setDetail({ reuseScreens: e.target.checked })} /> Reuse existing screens
                  </label>
                )}
              </div>
            </section>

            <input ref={fileInput} type="file" accept={PLACEABLE_ACCEPT} className="sr-only" aria-label="Artwork file" onChange={(e) => choose(e.target.files?.[0])} />
            {!area ? (
              <p className="rounded bg-gray-50 px-2 py-2 text-xs text-gray-600">
                Artwork is placed on a print area. For other locations, attach the artwork to the order under Files.
              </p>
            ) : picking ? (
              <section className="space-y-2 border-t border-gray-200 pt-4" data-testid="art-library">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium">{ownerName ? `${ownerName}'s artwork` : "Saved artwork"}</h3>
                  {loaded && (
                    <button type="button" className="text-xs text-amber-700 hover:underline" onClick={() => setPicking(false)}>Back to editing</button>
                  )}
                </div>
                {library && library.length > 12 && (
                  <input className="input" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find by file name" aria-label="Find artwork" />
                )}
                {library === null ? (
                  <p className="text-xs text-gray-500">Loading saved artwork…</p>
                ) : library.length === 0 ? (
                  <p className="rounded bg-gray-50 px-2 py-2 text-xs text-gray-600">
                    {owner?.customerId || owner?.companyId ? "No saved artwork for this customer yet. Upload a file and it's kept here for next time." : "Upload a file to place it."}
                  </p>
                ) : (
                  <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-1">
                    {library
                      .filter((a) => !filter || a.name.toLowerCase().includes(filter.toLowerCase()))
                      .map((a) => (
                        <button
                          key={a.fileId}
                          type="button"
                          className={`rounded border p-1 text-left hover:border-amber-500 ${loaded && (loaded.libraryFileId ?? loaded.sourceFileId) === a.fileId ? "border-amber-500 ring-1 ring-amber-500" : "border-gray-200"}`}
                          title={`${a.name} · ${a.owner}`}
                          onClick={() => pick(a)}
                          disabled={!!busy}
                          data-testid="library-art"
                        >
                          <span className="block aspect-square overflow-hidden rounded bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)] bg-[length:12px_12px]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={staffFileUrl(a.fileId)} alt="" loading="lazy" className="h-full w-full object-contain" />
                          </span>
                          <span className="mt-1 block truncate text-[11px] text-gray-700">{a.name}</span>
                        </button>
                      ))}
                  </div>
                )}
                <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()} disabled={!!busy}>
                  📎 Upload new artwork
                </button>
                <p className="text-xs text-gray-500">
                  PNG, JPG, GIF, WebP or SVG.{owner?.customerId || owner?.companyId ? " New uploads are saved to this customer's artwork." : ""}
                </p>
              </section>
            ) : (
              <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-4">
                <button type="button" className="btn-secondary" onClick={() => setPicking(true)}>
                  🖼 Choose different artwork
                </button>
                {loaded && (
                  <button type="button" className="btn-secondary text-red-700" onClick={removeArt}>Remove artwork</button>
                )}
              </div>
            )}
            {busy && <p className="text-amber-800" role="status">{busy}</p>}
            {error && <p className="rounded bg-red-50 px-2 py-1 text-red-800" role="alert">{error}</p>}

            {!picking && view && placed && size && area && (
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
                  {enhance ? (
                    <p className={`rounded px-2 py-1 text-xs ${RATING[rating].cls}`} data-testid="dpi">
                      {PRINT_DPI} DPI at this size:{" "}
                      {enhance.method === "vector" ? "traced to vector, sharp at any size" : `enlarged from ${Math.round(rawDpi)} DPI (smoother, but no new detail)`}.{" "}
                      <button type="button" className="text-amber-700 hover:underline" onClick={() => edit({ enhance: undefined })}>Undo</button>
                    </p>
                  ) : (
                    <p className={`rounded px-2 py-1 text-xs ${RATING[rating].cls}`} data-testid="dpi">
                      {Math.round(dpi)} DPI at this size: {RATING[rating].text}
                      {rating === "low" && ` (needs ${method?.minDpi ?? 150}+).`}
                    </p>
                  )}
                  {!enhance && !enhancing && rawDpi < PRINT_DPI && (
                    <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={openEnhance} disabled={!!busy}>
                      ✨ Enhance for print ({PRINT_DPI} DPI)
                    </button>
                  )}
                  {enhancing && (
                    <div className="space-y-2 rounded border border-amber-300 bg-amber-50/40 p-2 text-xs" data-testid="enhance-panel">
                      <p className="text-gray-700">
                        {enhancing.flat
                          ? "This looks like flat-color art. Tracing it to vector gives sharp edges at any size."
                          : "This looks like a photo or detailed art. Tracing would posterize it; enlarging smooths it but can't add detail."}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <figure>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={enhancing.before} alt="Close-up as it is" className="aspect-square w-full rounded border bg-white object-contain [image-rendering:pixelated]" />
                          <figcaption className="text-[11px] text-gray-500">Now (close-up)</figcaption>
                        </figure>
                        <figure>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={enhancing.method === "vector" && enhancing.vector ? enhancing.vector : enhancing.resized}
                            alt="Close-up enhanced"
                            className="aspect-square w-full rounded border bg-white object-contain"
                            data-testid="enhance-after"
                          />
                          <figcaption className="text-[11px] text-gray-500">{enhancing.method === "vector" ? "Traced to vector" : "Enlarged"}</figcaption>
                        </figure>
                      </div>
                      <div className="space-y-1">
                        <label className="flex items-center gap-1.5">
                          <input type="radio" name="enhance-method" checked={enhancing.method === "vector"} onChange={() => setEnhancing({ ...enhancing, method: "vector" })} />
                          Trace to vector{enhancing.flat ? " (recommended)" : ""}
                        </label>
                        <label className="flex items-center gap-1.5">
                          <input type="radio" name="enhance-method" checked={enhancing.method === "resize"} onChange={() => setEnhancing({ ...enhancing, method: "resize" })} />
                          Enlarge smoothly{enhancing.flat ? "" : " (recommended)"}
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn px-2 py-1 text-xs"
                          onClick={() => {
                            edit({ enhance: { method: enhancing.method, fromDpi: Math.round(rawDpi) } });
                            setEnhancing(null);
                          }}
                        >
                          Use {enhancing.method === "vector" ? "vector" : "enlarged"} artwork
                        </button>
                        <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => setEnhancing(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
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
                    <>
                      <div className="grid grid-cols-8 gap-1.5" data-testid="palette">
                        {view.colors.map((c) => {
                          const to = edits.replace?.[c.hex];
                          return (
                            <label key={c.hex} className="flex flex-col items-center gap-0.5 text-[10px] text-gray-500" title={`${c.hex}${to ? ` → ${to}` : ""} · ${Math.round(c.share * 100)}% of the art. Click to change.`}>
                              <span className="relative h-7 w-7 overflow-hidden rounded border border-gray-300" style={{ background: to ?? c.hex }}>
                                {/* The original color in the corner once it's been changed. */}
                                {to && <span className="absolute top-0 left-0 h-3.5 w-3.5" style={{ background: c.hex, clipPath: "polygon(0 0, 100% 0, 0 100%)" }} />}
                                <input
                                  type="color"
                                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                  value={(to ?? c.hex).toLowerCase()}
                                  aria-label={`Change ${c.hex}`}
                                  onChange={(e) => edit({ replace: { ...edits.replace, [c.hex]: e.target.value.toUpperCase() } })}
                                />
                              </span>
                              {Math.max(1, Math.round(c.share * 100))}%
                            </label>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                        <label className="flex items-center gap-1.5">
                          Limit to
                          <select
                            className="rounded border border-gray-300 px-1 py-0.5"
                            value={edits.reduce ?? ""}
                            aria-label="Limit colors"
                            // Swaps were picked from the old colors, so they start over.
                            onChange={(e) => edit({ reduce: e.target.value ? Number(e.target.value) : undefined, replace: undefined })}
                          >
                            <option value="">—</option>
                            {Array.from({ length: MAX_PALETTE }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                          colors (flattens shading into solid inks)
                        </label>
                        {edits.replace && Object.keys(edits.replace).length > 0 && (
                          <button type="button" className="text-amber-700 hover:underline" onClick={() => edit({ replace: undefined })}>Undo color changes</button>
                        )}
                      </div>
                    </>
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

            <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-4">
              <button type="button" className="btn" disabled={!!busy || !method} onClick={save}>
                {decoration ? "Save decoration" : "Add decoration"}
              </button>
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              {onRemove && (
                <button type="button" className="btn-danger ml-auto" onClick={onRemove}>Remove decoration</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
