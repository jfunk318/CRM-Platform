// Browser-only helpers for the design studio: turn image files into pixels
// and pixels back into images.

import type { Raster } from "./raster";

/** Edits run on at most this many pixels across; bigger art is scaled down while editing. */
export const MAX_EDIT_PX = 3000;
/** Vector art has no pixel size of its own; it's drawn this large. */
const VECTOR_PX = 3000;

export type LoadedArt = {
  raster: Raster;
  /** Edit pixels per original pixel (1 unless the art was scaled down to edit). */
  scale: number;
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That image couldn't be opened"));
    img.src = url;
  });
}

/** Read a PNG/JPG/GIF/WebP/SVG (a File, Blob or same-site URL) into pixels. */
export async function loadArt(src: Blob | string, isVector: boolean): Promise<LoadedArt> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = await loadImage(url);
    let w = img.naturalWidth || 1000;
    let h = img.naturalHeight || 1000;
    let scale = 1;
    if (isVector) {
      // Draw vectors big; the original "pixel size" is whatever we draw.
      const k = VECTOR_PX / Math.max(w, h);
      w = Math.round(w * k);
      h = Math.round(h * k);
    } else if (Math.max(w, h) > MAX_EDIT_PX) {
      scale = MAX_EDIT_PX / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    return { raster: { data: data.data, width: w, height: h }, scale };
  } finally {
    if (typeof src !== "string") URL.revokeObjectURL(url);
  }
}

/** A smaller copy for live previews (edits are redone at full size on save). */
export function downscale(r: Raster, maxPx: number): Raster {
  const k = Math.min(1, maxPx / Math.max(r.width, r.height));
  if (k === 1) return r;
  const small = document.createElement("canvas");
  small.width = Math.max(1, Math.round(r.width * k));
  small.height = Math.max(1, Math.round(r.height * k));
  const ctx = small.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(toCanvas(r), 0, 0, small.width, small.height);
  const data = ctx.getImageData(0, 0, small.width, small.height);
  return { data: data.data, width: small.width, height: small.height };
}

function toCanvas(r: Raster): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = r.width;
  canvas.height = r.height;
  canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.width, r.height), 0, 0);
  return canvas;
}

export function rasterToPng(r: Raster): Promise<Blob> {
  return new Promise((resolve, reject) => toCanvas(r).toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't save the image"))), "image/png"));
}

function pngOf(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't save the image"))), "image/png"));
}

/** Draw an SVG (with a viewBox) at exactly width × height pixels, as a PNG. */
export async function svgToPng(svg: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
    return pngOf(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Enlarge (or shrink) pixels smoothly to width × height, as a PNG. */
export function resizeToPng(r: Raster, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(toCanvas(r), 0, 0, width, height);
  return pngOf(canvas);
}

/** A region of the art (fractions of its size) as a data URL, for close-up comparisons. */
export function cropPreview(r: Raster, region: { x: number; y: number; w: number; h: number }): string {
  const sx = Math.round(region.x * r.width), sy = Math.round(region.y * r.height);
  const sw = Math.max(1, Math.round(region.w * r.width)), sh = Math.max(1, Math.round(region.h * r.height));
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  canvas.getContext("2d")!.drawImage(toCanvas(r), sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL("image/png");
}

/** A quick preview image (smaller than the real art) as a data URL. */
export function rasterPreview(r: Raster, maxPx = 900): string {
  const full = toCanvas(r);
  const k = Math.min(1, maxPx / Math.max(r.width, r.height));
  if (k === 1) return full.toDataURL("image/png");
  const small = document.createElement("canvas");
  small.width = Math.max(1, Math.round(r.width * k));
  small.height = Math.max(1, Math.round(r.height * k));
  small.getContext("2d")!.drawImage(full, 0, 0, small.width, small.height);
  return small.toDataURL("image/png");
}
