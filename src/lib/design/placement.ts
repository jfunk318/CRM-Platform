// Where artwork sits in a print area, and what that means in inches and DPI.
//
// A print area has a real size (widthIn × heightIn) and a box on the product
// photo (x, y, w, h as fractions of the photo). Artwork placement is stored
// as fractions of that box: its left and top edge, and its width. Its height
// follows the artwork's own shape.

export type AreaBox = { widthIn: number; heightIn: number; x: number; y: number; w: number; h: number };
export type Placement = { x: number; y: number; w: number; rotation: number };
export type ArtSize = { widthPx: number; heightPx: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const aspect = (art: ArtSize) => (art.widthPx > 0 && art.heightPx > 0 ? art.heightPx / art.widthPx : 1);

/** The artwork's printed size in inches. */
export function printSize(area: Pick<AreaBox, "widthIn">, place: Pick<Placement, "w">, art: ArtSize) {
  const widthIn = place.w * area.widthIn;
  return { widthIn, heightIn: widthIn * aspect(art) };
}

/** Height of the artwork as a fraction of the area's height. */
export const heightFraction = (area: Pick<AreaBox, "widthIn" | "heightIn">, place: Pick<Placement, "w">, art: ArtSize) =>
  area.heightIn > 0 ? printSize(area, place, art).heightIn / area.heightIn : 0;

/** Largest placement that fits the area, centered across and at the top (where prints usually start). */
export function fitPlacement(area: Pick<AreaBox, "widthIn" | "heightIn">, art: ArtSize): Placement {
  const a = aspect(art);
  const widthIn = Math.min(area.widthIn, area.heightIn / a);
  const w = area.widthIn > 0 ? widthIn / area.widthIn : 1;
  return { x: (1 - w) / 2, y: 0, w, rotation: 0 };
}

/** Keep the artwork inside the area: no bigger than it, and not past its edges. */
export function clampPlacement(area: Pick<AreaBox, "widthIn" | "heightIn">, place: Placement, art: ArtSize): Placement {
  const a = aspect(art);
  const maxW = Math.min(1, area.heightIn / a / (area.widthIn || 1));
  const w = clamp(place.w, 0.02, maxW);
  const h = heightFraction(area, { w }, art);
  return { x: clamp(place.x, 0, 1 - w), y: clamp(place.y, 0, Math.max(0, 1 - h)), w, rotation: ((place.rotation % 360) + 360) % 360 };
}

/** Print resolution of the artwork at its placed size. */
export const effectiveDpi = (art: ArtSize, widthIn: number) => (widthIn > 0 ? art.widthPx / widthIn : 0);

export type DpiRating = "good" | "ok" | "low";

/** Against a method's minimum and ideal resolution (defaults suit most garment printing). */
export function dpiRating(dpi: number, method: { minDpi?: number | null; perfectDpi?: number | null }): DpiRating {
  const min = method.minDpi ?? 150;
  const perfect = method.perfectDpi ?? 300;
  return dpi >= perfect ? "good" : dpi >= min ? "ok" : "low";
}

/**
 * The artwork's box on the product photo, as fractions of the (square)
 * photo frame, for drawing mockups. Height follows the artwork's shape, as
 * an image drawn at that width would.
 */
export function photoRect(area: AreaBox, place: Placement, art: ArtSize) {
  const width = place.w * area.w;
  return { left: area.x + place.x * area.w, top: area.y + place.y * area.h, width, height: width * aspect(art) };
}
