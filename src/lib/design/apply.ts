// Putting one decoration on many items: the same artwork and process, placed
// and sized for each product's print areas. Pure, so the bulk tools in the
// browser and the tests share it. Each result is a separate copy; changing
// one item later never touches the others.

import type { ArtworkValue } from "./artwork";
import { bestFit, commonWidthIn, DEFAULT_STITCH_DENSITY, estimateStitches, guideFor, maxWidthIn, placeAtWidth, type PlacementGuide, transferPlacement } from "./guides";
import { type AreaBox, printSize } from "./placement";

export type TargetArea = AreaBox & { id: string; label: string };

/** The decoration fields this needs; anything else on it is copied as is. */
export type ApplyDecoration = {
  methodId: string;
  areaId: string;
  location: string;
  artwork: ArtworkValue | null;
  colors: string;
  stitches: string;
  widthIn: string;
  heightIn: string;
  stitchesSet?: boolean;
};

/**
 * "same": the printed size as designed on every item (shrunk only where it
 * can't fit), as one set of screens or one digitized file needs.
 * "fit": scaled to each product, filling the same share of the space the
 * guideline allows there (smaller on youth sizes, bigger on 3XL panels).
 */
export type SizeMode = "same" | "fit";

const round2 = (n: number) => Math.round(n * 100) / 100;
export const locationKey = (label: string) => label.trim().toLowerCase().replace(/\s+/g, " ");
const areaName = (label: string) => locationKey(label.split("/").pop() ?? label);

/**
 * The print area on a product for a location chosen on another product:
 * the same "View / Area" name, else the same area name on any view, else
 * an area under the same guideline (e.g. "Front / Chest" for "Left Chest").
 */
export function matchArea<A extends TargetArea>(areas: A[], label: string, guides: PlacementGuide[]): A | null {
  const key = locationKey(label);
  const name = areaName(label);
  const guide = guideFor(label, guides);
  return (
    areas.find((a) => locationKey(a.label) === key) ??
    areas.find((a) => areaName(a.label) === name) ??
    (guide ? (areas.find((a) => guideFor(a.label, guides) === guide) ?? null) : null)
  );
}

export type Placed<D> = { decoration: D; shrunk: boolean } | { decoration: null; reason: string };

/**
 * Place a designed decoration (its artwork already positioned on `sourceArea`)
 * on one target area. `reference` is the size the artwork should print at
 * when it isn't on the designed location (see `referenceWidths`).
 */
export function placeDecoration<D extends ApplyDecoration>(
  source: D,
  sourceArea: TargetArea | null,
  target: TargetArea,
  o: { mode: SizeMode; guides: PlacementGuide[]; referenceWidthIn?: number; stitchDensity?: number },
): Placed<D> {
  const art = source.artwork;
  if (!art) {
    // No artwork yet: the decoration's details carry over to the new location.
    return { decoration: { ...source, areaId: target.id, location: target.label }, shrunk: false };
  }
  const size = { widthPx: art.widthPx, heightPx: art.heightPx };
  const guide = guideFor(target.label, o.guides);
  const designedHere = !!sourceArea && locationKey(sourceArea.label) === locationKey(target.label);
  let place;
  let shrunk = false;
  if (designedHere && sourceArea) {
    // Where it was designed: the same position, at the designed size or the same share of the room.
    let from = { x: art.x, y: art.y, w: art.w, rotation: art.rotation };
    if (o.mode === "fit") {
      const designedWidth = printSize(sourceArea, from, size).widthIn;
      const share = designedWidth / (maxWidthIn(sourceArea, size, guideFor(sourceArea.label, o.guides)) || designedWidth || 1);
      const w = (share * maxWidthIn(target, size, guide)) / (sourceArea.widthIn || 1);
      from = { ...from, x: from.x + from.w / 2 - w / 2, w };
    }
    ({ place, shrunk } = transferPlacement(sourceArea, from, target, size, o.guides));
    if (o.mode === "fit") shrunk = false;
  } else if (o.mode === "same" && o.referenceWidthIn) {
    // Another location: one size for every item, as big as fits them all.
    const width = Math.min(o.referenceWidthIn, maxWidthIn(target, size, guide));
    shrunk = width < o.referenceWidthIn - 0.005;
    place = placeAtWidth(target, size, width, guide?.align ?? "top");
  } else {
    place = bestFit(target, size, o.guides);
  }
  const printed = printSize(target, place, size);
  const widthIn = round2(printed.widthIn);
  const heightIn = round2(printed.heightIn);
  // A typed-in stitch count holds only while the size does.
  const sameSize = Math.abs(widthIn - Number(source.widthIn)) < 0.01;
  const keepStitches = !!source.stitchesSet && sameSize;
  const stitches = source.stitches
    ? keepStitches
      ? source.stitches
      : String(estimateStitches(widthIn, heightIn, art.coverage, o.stitchDensity ?? DEFAULT_STITCH_DENSITY))
    : source.stitches;
  return {
    decoration: {
      ...source,
      areaId: target.id,
      location: target.label,
      artwork: { ...art, ...place },
      widthIn: String(widthIn),
      heightIn: String(heightIn),
      stitches,
      stitchesSet: keepStitches,
    },
    shrunk,
  };
}

/**
 * For each chosen location other than the designed one, one printed width
 * for "same size" mode: the largest that fits that location on every item.
 */
export function referenceWidths(locations: string[], areasPerItem: TargetArea[][], art: { widthPx: number; heightPx: number }, guides: PlacementGuide[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const loc of locations) {
    const found = areasPerItem.map((areas) => matchArea(areas, loc, guides)).filter((a): a is TargetArea => !!a);
    if (found.length) out.set(locationKey(loc), commonWidthIn(found, art, guides));
  }
  return out;
}

/** An item's decorations with new ones put in: each replaces whatever was at its location, else it's added. */
export function mergeDecorations<D extends Pick<ApplyDecoration, "areaId" | "location">>(existing: D[], incoming: D[]): D[] {
  const next = [...existing];
  for (const d of incoming) {
    const i = next.findIndex((x) => (d.areaId && x.areaId === d.areaId) || locationKey(x.location) === locationKey(d.location));
    if (i >= 0) next[i] = d;
    else next.push(d);
  }
  return next;
}

export { round2 };
