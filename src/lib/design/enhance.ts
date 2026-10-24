// "Enhance for print": get low-resolution artwork to 300 DPI at its placed
// size. Flat-color art (logos, type, spot colors) is traced to vector shapes
// and redrawn at full resolution, so edges are genuinely sharp. Anything
// else can only be enlarged smoothly, which is labelled as such: enlarging
// doesn't add detail.

import ImageTracer from "imagetracerjs";
import { hexToRgb, MAX_PALETTE, palette, type Raster } from "./raster";

export const PRINT_DPI = 300;
/** Largest print file we'll make (24 in at 300 DPI). */
export const MAX_PRINT_PX = 7200;

export type EnhanceMethod = "vector" | "resize";
/** What was done, kept with the artwork's edits so production knows. */
export type Enhancement = { method: EnhanceMethod; fromDpi: number; vectorFileId?: string };

/** Pixels across needed for `dpi` at a printed width. */
export const targetWidthPx = (widthIn: number, dpi = PRINT_DPI) => Math.min(MAX_PRINT_PX, Math.max(1, Math.round(widthIn * dpi)));

/**
 * How much of the visible art sits on one of its main colors (0–1). Logos
 * and spot-color art score high; photos, gradients and texture score low.
 */
export function flatness(img: Raster, colors = palette(img).map((p) => p.hex)): number {
  const pal = colors.map(hexToRgb);
  if (pal.length === 0) return 0;
  const step = Math.max(1, Math.floor((img.width * img.height) / 200_000));
  let opaque = 0, near = 0;
  for (let i = 0; i < img.width * img.height; i += step) {
    if (img.data[i * 4 + 3] < 128) continue;
    opaque++;
    const r = img.data[i * 4], g = img.data[i * 4 + 1], b = img.data[i * 4 + 2];
    const d = Math.min(...pal.map((p) => (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2));
    if (d <= 40 ** 2) near++;
  }
  return opaque ? near / opaque : 0;
}

/** Whether tracing to vector suits this art (flat colors, at most 8 of them). */
export const suitsVector = (img: Raster) => flatness(img, palette(img, { maxColors: MAX_PALETTE }).map((p) => p.hex)) >= 0.9;

/**
 * Trace art to an SVG using its own colors (plus transparency), with a
 * viewBox so it can be drawn at any size.
 */
export function traceToSvg(img: Raster, colors = palette(img, { maxColors: MAX_PALETTE }).map((p) => p.hex)): string {
  const pal = [{ r: 0, g: 0, b: 0, a: 0 }, ...colors.map((hex) => {
    const [r, g, b] = hexToRgb(hex);
    return { r, g, b, a: 255 };
  })];
  const svg = ImageTracer.imagedataToSVG(
    { width: img.width, height: img.height, data: img.data },
    // The art's own palette, kept as-is; small specks dropped; thin same-color strokes hide seams between shapes.
    { pal, colorsampling: 0, colorquantcycles: 1, pathomit: 4, ltres: 0.5, qtres: 0.5, roundcoords: 2, strokewidth: 0.75, viewbox: true, rightangleenhance: true },
  );
  // Transparent areas trace as invisible shapes; leave them out.
  return svg.replace(/<path[^>]*fill="rgb\(0,0,0\)"[^>]*opacity="0"[^>]*\/>/g, "");
}

/** The SVG sized for drawing at width × height pixels. */
export const sizedSvg = (svg: string, width: number, height: number) =>
  svg.replace(/<svg\b/, `<svg width="${width}" height="${height}" preserveAspectRatio="none"`);
