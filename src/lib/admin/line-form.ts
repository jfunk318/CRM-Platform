import type { ArtworkSpec, DecorationSpec, LineSpec } from "@/lib/orders/service";
import { all, FormError, optionalText, text } from "./form";

// Reads the fields <LineEditor> renders: product, color, sizes and the
// repeated d_* decoration fields.

export function optionalNumber(raw: string | undefined, label: string, integer = false): number | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new FormError(`${label} must be a positive number`);
  if (integer && !Number.isInteger(n)) throw new FormError(`${label} must be a whole number`);
  return n;
}

const fraction = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
const id = (v: unknown) => typeof v === "string" && /^[a-z0-9]{10,40}$/.test(v);

/** The artwork JSON the design studio puts in d_artwork (blank = no artwork). */
export function parseArtwork(raw: string | undefined, i: number): ArtworkSpec | null {
  if (!raw?.trim()) return null;
  let a: Record<string, unknown>;
  try {
    a = JSON.parse(raw);
  } catch {
    throw new FormError(`Decoration ${i + 1}: the artwork details are damaged; place it again`);
  }
  const px = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 50_000;
  const ok =
    id(a.artworkFileId) &&
    (a.sourceFileId === null || a.sourceFileId === undefined || id(a.sourceFileId)) &&
    px(a.widthPx) &&
    px(a.heightPx) &&
    fraction(a.x) &&
    fraction(a.y) &&
    fraction(a.w) &&
    (a.w as number) > 0 &&
    typeof a.rotation === "number" &&
    Number.isFinite(a.rotation) &&
    (a.edits === undefined || (typeof a.edits === "object" && a.edits !== null && !Array.isArray(a.edits))) &&
    (a.coverage === undefined || a.coverage === null || fraction(a.coverage));
  if (!ok) throw new FormError(`Decoration ${i + 1}: the artwork details are damaged; place it again`);
  return {
    artworkFileId: a.artworkFileId as string,
    sourceFileId: (a.sourceFileId as string | undefined) ?? null,
    edits: (a.edits as Record<string, unknown>) ?? {},
    widthPx: a.widthPx as number,
    heightPx: a.heightPx as number,
    x: a.x as number,
    y: a.y as number,
    w: a.w as number,
    rotation: ((a.rotation as number) % 360 + 360) % 360,
    coverage: (a.coverage as number | null | undefined) ?? null,
  };
}

export function parseLine(form: FormData): LineSpec {
  const quantities: Record<string, number> = {};
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("qty_")) continue;
    const qty = optionalNumber(String(value), "Quantity", true);
    if (qty) quantities[key.slice(4)] = qty;
  }
  const [methods, areas, locations, colors, stitches, widths, heights, inks, art, dig, reuse, artwork, stitchesSet] = [
    "d_method", "d_area", "d_location", "d_colors", "d_stitches", "d_w", "d_h", "d_inks", "d_art", "d_dig", "d_reuse", "d_artwork", "d_stitches_set",
  ].map((n) => all(form, n));
  const decorations: DecorationSpec[] = methods.map((methodId, i) => {
    if (!methodId) throw new FormError(`Decoration ${i + 1}: choose a method`);
    return {
      methodId,
      areaId: areas[i] || null,
      location: locations[i] ?? "",
      colors: optionalNumber(colors[i], "Ink colors", true),
      stitches: optionalNumber(stitches[i], "Stitches", true),
      widthIn: optionalNumber(widths[i], "Width"),
      heightIn: optionalNumber(heights[i], "Height"),
      inkColors: (inks[i] ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      needsArtwork: art[i] === "on",
      needsDigitizing: dig[i] === "on",
      reuseScreens: reuse[i] === "on",
      stitchesSet: stitchesSet[i] === "on",
      artwork: parseArtwork(artwork[i], i),
    };
  });
  return {
    productId: text(form, "productId", "Product"),
    colorId: text(form, "colorId", "Color"),
    quantities,
    decorations,
    notes: optionalText(form, "notes"),
    // Only forms with a roster box change the roster.
    roster: form.has("roster") ? String(form.get("roster")) : undefined,
  };
}

/** Sizes ticked in the editor's "select" mode. */
export const selectedSizes = (form: FormData) => [...form.keys()].filter((k) => k.startsWith("size_")).map((k) => k.slice(5));

/**
 * A line sent as JSON by the bulk tools (the item editor's values), read
 * exactly as the item form is, so the same checks apply.
 */
export function parseLineJson(raw: unknown, label = "An item"): LineSpec {
  const v = (raw ?? {}) as Record<string, unknown>;
  const s = (x: unknown) => (typeof x === "string" ? x : x === null || x === undefined ? "" : String(x));
  const form = new FormData();
  form.set("productId", s(v.productId));
  form.set("colorId", s(v.colorId));
  if (typeof v.notes === "string") form.set("notes", v.notes);
  if (typeof v.roster === "string") form.set("roster", v.roster);
  for (const [sizeId, qty] of Object.entries((v.quantities ?? {}) as Record<string, unknown>)) form.set(`qty_${sizeId}`, s(qty));
  const decorations = Array.isArray(v.decorations) ? v.decorations : [];
  if (decorations.length > 20) throw new FormError(`${label}: too many decorations`);
  for (const raw of decorations) {
    const d = (raw ?? {}) as Record<string, unknown>;
    const on = (x: unknown) => (x === true ? "on" : "");
    form.append("d_method", s(d.methodId));
    form.append("d_area", s(d.areaId));
    form.append("d_location", s(d.location));
    form.append("d_colors", s(d.colors));
    form.append("d_stitches", s(d.stitches));
    form.append("d_w", s(d.widthIn));
    form.append("d_h", s(d.heightIn));
    form.append("d_inks", s(d.inkColors));
    form.append("d_art", on(d.needsArtwork));
    form.append("d_dig", on(d.needsDigitizing));
    form.append("d_reuse", on(d.reuseScreens));
    form.append("d_stitches_set", on(d.stitchesSet));
    form.append("d_artwork", d.artwork ? JSON.stringify(d.artwork) : "");
  }
  try {
    return parseLine(form);
  } catch (e) {
    if (e instanceof FormError) throw new FormError(`${label}: ${e.message}`);
    throw e;
  }
}
