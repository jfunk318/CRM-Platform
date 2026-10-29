// Placement guidelines and automatic sizing: where artwork goes in a print
// area and how big, so the same logo lands correctly on many products at
// once. Pure, so the designer, the bulk tools and the server share it.
//
// A guide caps the artwork's size for a kind of location (a left-chest
// logo is about 4″ even when the product's print area allows more) and says
// where it sits in the area (top for chests and backs, middle for hats).

import { type AreaBox, clampPlacement, heightFraction, type Placement, printSize, type ArtSize } from "./placement";

export type GuideAlign = "top" | "center" | "bottom";

export type PlacementGuide = {
  name: string;
  /** Matches print areas whose name contains any of these words (any case). */
  keywords: string[];
  maxWidthIn: number;
  maxHeightIn: number;
  align: GuideAlign;
};

/** Standard decorating sizes; a business can change them (Settings → Placement guides). */
export const DEFAULT_GUIDES: PlacementGuide[] = [
  { name: "Left / right chest", keywords: ["left chest", "right chest", "chest"], maxWidthIn: 4, maxHeightIn: 4, align: "top" },
  { name: "Pocket", keywords: ["pocket"], maxWidthIn: 3.5, maxHeightIn: 3.5, align: "top" },
  { name: "Full front", keywords: ["full front", "front"], maxWidthIn: 12, maxHeightIn: 14, align: "top" },
  { name: "Upper back / yoke", keywords: ["upper back", "yoke", "nameplate", "neck"], maxWidthIn: 12, maxHeightIn: 4, align: "top" },
  { name: "Full back", keywords: ["full back", "back"], maxWidthIn: 12, maxHeightIn: 14, align: "top" },
  { name: "Sleeve", keywords: ["sleeve"], maxWidthIn: 3.5, maxHeightIn: 3.5, align: "top" },
  { name: "Hat front", keywords: ["hat front", "cap front", "hat", "cap", "crown", "visor"], maxWidthIn: 4.5, maxHeightIn: 2.25, align: "center" },
  { name: "Leg / hip", keywords: ["leg", "hip", "thigh"], maxWidthIn: 3.5, maxHeightIn: 4, align: "top" },
];

const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);

/** A business's saved guides, or the defaults; anything malformed is dropped. */
export function guidesFrom(raw: unknown): PlacementGuide[] {
  if (!Array.isArray(raw)) return DEFAULT_GUIDES;
  return raw.flatMap((g): PlacementGuide[] => {
    const o = (g ?? {}) as Record<string, unknown>;
    const w = num(o.maxWidthIn, 0.25, 60);
    const h = num(o.maxHeightIn, 0.25, 60);
    const keywords = Array.isArray(o.keywords) ? o.keywords.filter((k): k is string => typeof k === "string" && !!k.trim()).map((k) => k.trim().toLowerCase()) : [];
    if (typeof o.name !== "string" || !o.name.trim() || !w || !h || keywords.length === 0) return [];
    const align: GuideAlign = o.align === "center" || o.align === "bottom" ? o.align : "top";
    return [{ name: o.name.trim(), keywords, maxWidthIn: w, maxHeightIn: h, align }];
  });
}

/**
 * The guide for a print area, from its name: the area's own name first
 * ("Left Chest"), then the whole label with the view ("Back / Upper").
 * Longer keywords win, so "full back" beats "back" and "left chest" beats
 * "chest".
 */
export function guideFor(areaLabel: string, guides: PlacementGuide[]): PlacementGuide | null {
  const match = (name: string) => {
    let best: { guide: PlacementGuide; len: number } | null = null;
    for (const guide of guides) {
      for (const k of guide.keywords) {
        if (name.includes(k) && (!best || k.length > best.len)) best = { guide, len: k.length };
      }
    }
    return best?.guide ?? null;
  };
  const label = areaLabel.toLowerCase();
  return match(label.split("/").pop()!.trim()) ?? match(label);
}

type Area = Pick<AreaBox, "widthIn" | "heightIn">;
const aspect = (art: ArtSize) => (art.widthPx > 0 && art.heightPx > 0 ? art.heightPx / art.widthPx : 1);

/** The biggest the artwork can print in this area under its guide, in inches across. */
export function maxWidthIn(area: Area, art: ArtSize, guide: PlacementGuide | null): number {
  const maxW = Math.min(area.widthIn, guide?.maxWidthIn ?? Infinity);
  const maxH = Math.min(area.heightIn, guide?.maxHeightIn ?? Infinity);
  return Math.max(0, Math.min(maxW, maxH / aspect(art)));
}

/** Put artwork of a given printed width in the area: centered across, at the guide's height. */
export function placeAtWidth(area: Area, art: ArtSize, widthIn: number, align: GuideAlign = "top"): Placement {
  const w = area.widthIn > 0 ? Math.min(1, widthIn / area.widthIn) : 1;
  const h = heightFraction(area, { w }, art);
  const y = align === "center" ? (1 - h) / 2 : align === "bottom" ? 1 - h : 0;
  return clampPlacement(area, { x: (1 - w) / 2, y, w, rotation: 0 }, art);
}

/** As big as the guide allows, positioned the guide's way. */
export function bestFit(area: Area & { label: string }, art: ArtSize, guides: PlacementGuide[]): Placement {
  const guide = guideFor(area.label, guides);
  return placeAtWidth(area, art, maxWidthIn(area, art, guide), guide?.align ?? "top");
}

/**
 * Copy a placement to another product's area: the same printed width
 * (shrunk if it doesn't fit there) and the same position, measured in
 * inches from the area's center line and top edge, so "3″ down, centered"
 * stays that on a youth shirt too.
 */
export function transferPlacement(from: Area, place: Placement, to: Area & { label: string }, art: ArtSize, guides: PlacementGuide[]): { place: Placement; widthIn: number; shrunk: boolean } {
  const wanted = printSize(from, place, art).widthIn;
  const limit = maxWidthIn(to, art, guideFor(to.label, guides));
  const widthIn = Math.min(wanted, limit);
  const w = to.widthIn > 0 ? widthIn / to.widthIn : 1;
  // Offsets in inches: from the center line across, from the top edge down.
  const centerOffIn = (place.x + place.w / 2 - 0.5) * from.widthIn;
  const topIn = place.y * from.heightIn;
  const next = clampPlacement(to, { x: 0.5 + centerOffIn / (to.widthIn || 1) - w / 2, y: topIn / (to.heightIn || 1), w, rotation: place.rotation }, art);
  return { place: next, widthIn, shrunk: widthIn < wanted - 0.005 };
}

/** The largest width that fits every one of these areas (for one print size across products). */
export function commonWidthIn(areas: (Area & { label: string })[], art: ArtSize, guides: PlacementGuide[]): number {
  return areas.reduce((w, a) => Math.min(w, maxWidthIn(a, art, guideFor(a.label, guides))), Infinity);
}

// ─── Embroidery stitch estimates ────────────────────────────────────────────

/** Stitches per square inch of stitched area when a method doesn't say. */
export const DEFAULT_STITCH_DENSITY = 1800;
const MIN_STITCHES = 1000;

/**
 * Estimated stitch count for embroidery: the stitched part of the artwork
 * (its share of non-transparent pixels × its printed size) times the
 * method's density, rounded to the nearest 100. A digitized file's real
 * count can be typed over it.
 */
export function estimateStitches(widthIn: number, heightIn: number, coverage: number | null | undefined, density = DEFAULT_STITCH_DENSITY): number {
  const share = coverage === null || coverage === undefined || !Number.isFinite(coverage) ? 0.6 : Math.min(1, Math.max(0.02, coverage));
  const stitches = widthIn * heightIn * share * density;
  return Math.max(MIN_STITCHES, Math.round(stitches / 100) * 100);
}

/** Share of an image's pixels that aren't (nearly) transparent. */
export function coverageOf(img: { data: ArrayLike<number>; width: number; height: number }): number {
  const total = img.width * img.height;
  if (!total) return 0;
  // Every 4th pixel is plenty for an estimate.
  let seen = 0, solid = 0;
  for (let i = 3; i < img.data.length; i += 16) {
    seen++;
    if (img.data[i] > 32) solid++;
  }
  return seen ? Math.round((solid / seen) * 1000) / 1000 : 0;
}
