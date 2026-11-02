import type { ArtEdits } from "./raster";

/**
 * File types the design studio can place (others can still be attached to an
 * order as files). PDF, Illustrator, Photoshop, EPS and TIFF are turned into
 * a picture for the mockup (lib/design/convert.ts); the original is kept.
 */
export const PLACEABLE = ["png", "jpg", "jpeg", "gif", "webp", "svg", "pdf", "ai", "psd", "psb", "eps", "epsf", "tif", "tiff"];
export const PLACEABLE_ACCEPT = PLACEABLE.map((e) => `.${e}`).join(",") + ",image/png,image/jpeg,image/gif,image/webp,image/svg+xml,application/pdf";
/** What the pickers say they take. */
export const PLACEABLE_HINT = "PNG, JPG, SVG, PDF, AI, EPS, PSD or TIFF";
/** Files shown as a picture as they are (others get a file-type tile). */
export const isPicture = (name: string) => ["png", "jpg", "jpeg", "gif", "webp"].includes(name.toLowerCase().split(".").pop() ?? "");

/** An image in a customer's artwork library, as the studio's gallery lists it. */
export type LibraryArt = { fileId: string; name: string; owner: string; addedAt: string };

/** Whose artwork library the studio shows and files new uploads under. */
export type ArtOwnerIds = { customerId: string | null; companyId: string | null };

/** Artwork on a decoration as the item editor holds it; `d_artwork` carries it without the URLs. */
export type ArtworkValue = {
  artworkFileId: string;
  sourceFileId: string | null;
  edits: ArtEdits;
  widthPx: number;
  heightPx: number;
  x: number;
  y: number;
  w: number;
  rotation: number;
  /** Share of the artwork that's ink or thread (0–1); missing on older artwork. */
  coverage?: number | null;
};

/** A decoration row's artwork, or null if none is placed. */
export function artworkOf(d: {
  artworkFileId: string | null;
  sourceFileId: string | null;
  artEdits: unknown;
  artWidthPx: number | null;
  artHeightPx: number | null;
  placeX: number | null;
  placeY: number | null;
  placeW: number | null;
  rotation: number;
  artCoverage?: number | null;
}): ArtworkValue | null {
  if (!d.artworkFileId || !d.artWidthPx || !d.artHeightPx || d.placeX === null || d.placeY === null || !d.placeW) return null;
  return {
    artworkFileId: d.artworkFileId,
    sourceFileId: d.sourceFileId,
    edits: (d.artEdits ?? {}) as ArtEdits,
    widthPx: d.artWidthPx,
    heightPx: d.artHeightPx,
    x: d.placeX,
    y: d.placeY,
    w: d.placeW,
    rotation: d.rotation,
    coverage: d.artCoverage ?? null,
  };
}

/** How artwork was brought up to print resolution, for staff ("traced to vector", "enlarged from 120 DPI"). */
export function enhanceLabel(edits: unknown): string | null {
  const e = (edits as ArtEdits | null | undefined)?.enhance;
  if (!e) return null;
  return e.method === "vector" ? "traced to vector" : `enlarged from ${e.fromDpi} DPI`;
}

/** Staff link to a stored file (artwork shown in the back office). */
export const staffFileUrl = (fileId: string) => `/admin/files/${fileId}`;

/**
 * The print area a designer opens on: Full Front (by name, as products and
 * spec sheets call it), then any front, then the first one.
 */
export function defaultArea<T extends { label: string }>(areas: T[]): T | undefined {
  return (
    areas.find((a) => /\bfull (front|chest)\b/i.test(a.label)) ??
    areas.find((a) => /\bfront\b/i.test(a.label) && !/\b(left|right|pocket)\b/i.test(a.label)) ??
    areas[0]
  );
}
