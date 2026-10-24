import { describe, expect, it } from "vitest";
import { flatness, sizedSvg, suitsVector, targetWidthPx, traceToSvg } from "./enhance";
import type { Raster } from "./raster";

/** A w × h image filled by `px(x, y)` → [r, g, b, a]. */
function make(w: number, h: number, px: (x: number, y: number) => number[]): Raster {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(px(x, y), (y * w + x) * 4);
  return { data, width: w, height: h };
}

// A two-color logo on transparency, and a smooth photo-like gradient.
const logo = make(40, 20, (x, y) => (y < 4 || y > 15 ? [0, 0, 0, 0] : x < 20 ? [204, 0, 0, 255] : [0, 0, 204, 255]));
const gradient = make(64, 64, (x, y) => [x * 4, y * 4, 128 + ((x * y) % 100), 255]);

describe("enhance for print", () => {
  it("knows flat logo art from photo-like art", () => {
    expect(flatness(logo)).toBe(1);
    expect(suitsVector(logo)).toBe(true);
    expect(suitsVector(gradient)).toBe(false);
  });

  it("works out the pixels needed for 300 DPI, within a sane maximum", () => {
    expect(targetWidthPx(12)).toBe(3600);
    expect(targetWidthPx(4.5)).toBe(1350);
    expect(targetWidthPx(40)).toBe(7200);
  });

  it("traces art to vector shapes in its own colors, leaving transparency out", () => {
    const svg = traceToSvg(logo);
    expect(svg).toContain('viewBox="0 0 40 20"');
    expect(svg).toContain('fill="rgb(204,0,0)"');
    expect(svg).toContain('fill="rgb(0,0,204)"');
    expect(svg).not.toMatch(/opacity="0"/);
    expect(sizedSvg(svg, 3600, 1800)).toMatch(/^<svg width="3600" height="1800"/);
  });
});
