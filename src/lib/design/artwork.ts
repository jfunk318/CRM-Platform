import type { ArtEdits } from "./raster";

/** Image types the design studio can place (others can still be attached to an order as files). */
export const PLACEABLE = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
export const PLACEABLE_ACCEPT = "image/png,image/jpeg,image/gif,image/webp,image/svg+xml,.svg";

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
  };
}

/** Staff link to a stored file (artwork shown in the back office). */
export const staffFileUrl = (fileId: string) => `/admin/files/${fileId}`;
