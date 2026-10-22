import type { DecorationSpec, LineSpec } from "@/lib/orders/service";
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

export function parseLine(form: FormData): LineSpec {
  const quantities: Record<string, number> = {};
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("qty_")) continue;
    const qty = optionalNumber(String(value), "Quantity", true);
    if (qty) quantities[key.slice(4)] = qty;
  }
  const [methods, areas, locations, colors, stitches, widths, heights, inks, art, dig, reuse] = [
    "d_method", "d_area", "d_location", "d_colors", "d_stitches", "d_w", "d_h", "d_inks", "d_art", "d_dig", "d_reuse",
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
    };
  });
  return {
    productId: text(form, "productId", "Product"),
    colorId: text(form, "colorId", "Color"),
    quantities,
    decorations,
    notes: optionalText(form, "notes"),
  };
}

/** Sizes ticked in the editor's "select" mode. */
export const selectedSizes = (form: FormData) => [...form.keys()].filter((k) => k.startsWith("size_")).map((k) => k.slice(5));
