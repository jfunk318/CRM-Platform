// Artwork editing on raw RGBA pixels. Pure functions with no browser APIs,
// so the design studio runs them on canvas pixels and tests run them on
// plain arrays.

export type Raster = { data: Uint8ClampedArray; width: number; height: number };
export type Rgb = [number, number, number];

/** Edits applied to an upload to get the artwork used in mockups, in order. */
export type ArtEdits = {
  /** Make the background transparent. `everywhere` also clears that color inside the art (the middle of an "O"). */
  removeBg?: { tolerance: number; everywhere?: boolean };
  /** Crop to the visible art. */
  trim?: boolean;
  /** Flatten the art to this many colors (screen-print separations). */
  reduce?: number;
  /** Swap colors: detected color hex → new hex. */
  replace?: Record<string, string>;
  /** Print everything in one ink color. */
  oneColor?: string;
  invert?: boolean;
};

const OPAQUE = 128;

export const hexToRgb = (hex: string): Rgb => {
  const h = hex.replace(/^#/, "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgbToHex = ([r, g, b]: Rgb) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase();

const dist2 = (a: Rgb, b: Rgb) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const at = (img: Raster, i: number): Rgb => [img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]];
const copy = (img: Raster): Raster => ({ data: new Uint8ClampedArray(img.data), width: img.width, height: img.height });

/** The most common color around the edge of the image: usually the background. */
export function edgeColor(img: Raster): Rgb | null {
  const { width: w, height: h } = img;
  const counts = new Map<number, { n: number; sum: Rgb }>();
  const add = (x: number, y: number) => {
    const i = y * w + x;
    if (img.data[i * 4 + 3] < OPAQUE) return;
    const c = at(img, i);
    const key = ((c[0] >> 4) << 8) | ((c[1] >> 4) << 4) | (c[2] >> 4);
    const e = counts.get(key) ?? { n: 0, sum: [0, 0, 0] as Rgb };
    e.n++;
    e.sum = [e.sum[0] + c[0], e.sum[1] + c[1], e.sum[2] + c[2]];
    counts.set(key, e);
  };
  for (let x = 0; x < w; x++) {
    add(x, 0);
    add(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    add(0, y);
    add(w - 1, y);
  }
  let best: { n: number; sum: Rgb } | null = null;
  for (const e of counts.values()) if (!best || e.n > best.n) best = e;
  return best ? [best.sum[0] / best.n, best.sum[1] / best.n, best.sum[2] / best.n] : null;
}

/**
 * Make the background transparent: pixels close to the edge color that are
 * connected to the edge (or, with `everywhere`, anywhere). Pixels just
 * outside the tolerance are faded rather than cut, for smooth edges.
 * Tolerance is 0–100.
 */
export function removeBackground(img: Raster, { tolerance, everywhere = false }: { tolerance: number; everywhere?: boolean }): Raster {
  const bg = edgeColor(img);
  const out = copy(img);
  if (!bg) return out;
  const { width: w, height: h } = img;
  const limit = (Math.max(0, Math.min(100, tolerance)) / 100) * 441; // 441 ≈ the largest RGB distance
  const soft = limit * 1.5 + 1;
  const d = (i: number) => Math.sqrt(dist2(at(img, i), bg));
  const clear = (i: number) => {
    const dd = d(i);
    if (dd <= limit) out.data[i * 4 + 3] = 0;
    else if (dd < soft) out.data[i * 4 + 3] = Math.min(out.data[i * 4 + 3], Math.round((255 * (dd - limit)) / (soft - limit)));
  };
  if (everywhere) {
    for (let i = 0; i < w * h; i++) clear(i);
    return out;
  }
  // Flood fill from the edges through background-colored pixels.
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (i: number) => {
    if (seen[i]) return;
    seen[i] = 1;
    if (img.data[i * 4 + 3] < OPAQUE || d(i) <= limit) stack.push(i);
    else clear(i); // the first pixel past the background softens the edge
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    out.data[i * 4 + 3] = 0;
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }
  return out;
}

/** The bounding box of the visible art, or null if it's all transparent. */
export function visibleBounds(img: Raster): { x: number; y: number; width: number; height: number } | null {
  let minX = img.width, minY = img.height, maxX = -1, maxY = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] <= 8) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Crop away transparent edges. */
export function trim(img: Raster): Raster {
  const b = visibleBounds(img);
  if (!b || (b.width === img.width && b.height === img.height)) return copy(img);
  const out: Raster = { data: new Uint8ClampedArray(b.width * b.height * 4), width: b.width, height: b.height };
  for (let y = 0; y < b.height; y++) {
    const from = ((b.y + y) * img.width + b.x) * 4;
    out.data.set(img.data.subarray(from, from + b.width * 4), y * b.width * 4);
  }
  return out;
}

export type PaletteColor = { hex: string; share: number };

/** Most colors a palette lists: more than this is never printed as separate inks. */
export const MAX_PALETTE = 8;

/**
 * The main colors in the art (ignoring transparent pixels), most used first,
 * consolidated to at most `maxColors`: near-identical shades merge, specks
 * and anti-aliasing under `minShare` fold into the nearest color, and then
 * the closest colors merge until few enough are left. For screen printing,
 * the count is the number of ink colors.
 */
export function palette(img: Raster, { maxColors = MAX_PALETTE, minShare = 0.01, mergeDistance = 48 } = {}): PaletteColor[] {
  const buckets = new Map<number, { n: number; sum: Rgb }>();
  let total = 0;
  // Large images are sampled; the palette doesn't need every pixel.
  const step = Math.max(1, Math.floor((img.width * img.height) / 250_000));
  for (let i = 0; i < img.width * img.height; i += step) {
    if (img.data[i * 4 + 3] < OPAQUE) continue;
    const c = at(img, i);
    const key = ((c[0] >> 3) << 10) | ((c[1] >> 3) << 5) | (c[2] >> 3);
    const e = buckets.get(key) ?? { n: 0, sum: [0, 0, 0] as Rgb };
    e.n++;
    e.sum = [e.sum[0] + c[0], e.sum[1] + c[1], e.sum[2] + c[2]];
    buckets.set(key, e);
    total++;
  }
  if (total === 0) return [];
  // Merge near-identical colors, most common first.
  const merged: { n: number; rgb: Rgb }[] = [];
  const limit = mergeDistance ** 2;
  for (const e of [...buckets.values()].sort((a, b) => b.n - a.n)) {
    const rgb: Rgb = [e.sum[0] / e.n, e.sum[1] / e.n, e.sum[2] / e.n];
    const near = merged.find((m) => dist2(m.rgb, rgb) <= limit);
    if (near) near.n += e.n;
    else merged.push({ n: e.n, rgb });
  }
  const mix = (a: { n: number; rgb: Rgb }, b: { n: number; rgb: Rgb }) => {
    const n = a.n + b.n;
    a.rgb = [0, 1, 2].map((k) => (a.rgb[k] * a.n + b.rgb[k] * b.n) / n) as Rgb;
    a.n = n;
  };
  // Specks fold into the nearest main color (so shares still add up).
  const main = merged.filter((m) => m.n / total >= minShare).slice(0, 64);
  if (main.length === 0) main.push(merged[0]);
  for (const m of merged) {
    if (main.includes(m)) continue;
    main.reduce((best, c) => (dist2(c.rgb, m.rgb) < dist2(best.rgb, m.rgb) ? c : best)).n += m.n;
  }
  // Merge the two closest colors until few enough are left.
  while (main.length > Math.max(1, maxColors)) {
    let bi = 0, bj = 1, bd = Infinity;
    for (let i = 0; i < main.length; i++) {
      for (let j = i + 1; j < main.length; j++) {
        const d = dist2(main[i].rgb, main[j].rgb);
        if (d < bd) [bi, bj, bd] = [i, j, d];
      }
    }
    mix(main[bi], main[bj]);
    main.splice(bj, 1);
  }
  return main.sort((a, b) => b.n - a.n).map((m) => ({ hex: rgbToHex(m.rgb), share: m.n / total }));
}

/** Snap every visible pixel to its nearest color in `colors` (flat, print-ready color). */
export function quantize(img: Raster, colors: string[]): Raster {
  const out = copy(img);
  const pal = colors.map(hexToRgb);
  if (pal.length === 0) return out;
  for (let i = 0; i < img.width * img.height; i++) {
    if (img.data[i * 4 + 3] === 0) continue;
    const c = at(img, i);
    let best = pal[0];
    for (const p of pal) if (dist2(c, p) < dist2(c, best)) best = p;
    out.data[i * 4] = best[0];
    out.data[i * 4 + 1] = best[1];
    out.data[i * 4 + 2] = best[2];
  }
  return out;
}

/**
 * Swap colors. Each visible pixel belongs to its nearest palette color; if
 * that color is being replaced, the pixel moves by the same amount, so
 * shading and anti-aliased edges stay smooth.
 */
export function replaceColors(img: Raster, colors: string[], replace: Record<string, string>): Raster {
  const out = copy(img);
  const from = colors.map(hexToRgb);
  const shift = colors.map((hex) => {
    const to = replace[hex];
    if (!to) return null;
    const a = hexToRgb(hex), b = hexToRgb(to);
    return [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as Rgb;
  });
  if (!shift.some(Boolean)) return out;
  for (let i = 0; i < img.width * img.height; i++) {
    if (img.data[i * 4 + 3] === 0) continue;
    const c = at(img, i);
    let best = 0;
    for (let k = 1; k < from.length; k++) if (dist2(c, from[k]) < dist2(c, from[best])) best = k;
    const s = shift[best];
    if (!s) continue;
    out.data[i * 4] = c[0] + s[0];
    out.data[i * 4 + 1] = c[1] + s[1];
    out.data[i * 4 + 2] = c[2] + s[2];
  }
  return out;
}

/** Everything visible in one color; transparency (and so soft edges) is kept. */
export function oneColor(img: Raster, hex: string): Raster {
  const out = copy(img);
  const [r, g, b] = hexToRgb(hex);
  for (let i = 0; i < img.width * img.height; i++) {
    out.data[i * 4] = r;
    out.data[i * 4 + 1] = g;
    out.data[i * 4 + 2] = b;
  }
  return out;
}

export function invert(img: Raster): Raster {
  const out = copy(img);
  for (let i = 0; i < img.width * img.height; i++) {
    out.data[i * 4] = 255 - img.data[i * 4];
    out.data[i * 4 + 1] = 255 - img.data[i * 4 + 1];
    out.data[i * 4 + 2] = 255 - img.data[i * 4 + 2];
  }
  return out;
}

/** Apply edits to the original upload, in a fixed order so results are repeatable. */
export function applyEdits(source: Raster, edits: ArtEdits): Raster {
  let img = source;
  if (edits.removeBg) img = removeBackground(img, edits.removeBg);
  if (edits.trim) img = trim(img);
  if (edits.reduce) img = quantize(img, palette(img, { maxColors: edits.reduce }).map((p) => p.hex));
  if (edits.replace && Object.keys(edits.replace).length) {
    // Swaps were chosen from a palette (perhaps of a smaller preview), so
    // match each to the nearest color found here rather than exactly.
    const colors = palette(img).map((p) => p.hex);
    const mapped: Record<string, string> = {};
    for (const [from, to] of Object.entries(edits.replace)) {
      const near = colors.reduce<string | null>((best, c) => (best === null || dist2(hexToRgb(c), hexToRgb(from)) < dist2(hexToRgb(best), hexToRgb(from)) ? c : best), null);
      if (near && dist2(hexToRgb(near), hexToRgb(from)) <= 60 ** 2) mapped[near] = to;
    }
    img = replaceColors(img, colors, mapped);
  }
  if (edits.oneColor) img = oneColor(img, edits.oneColor);
  if (edits.invert) img = invert(img);
  return img;
}
