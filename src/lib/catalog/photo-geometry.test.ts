import { describe, expect, it } from "vitest";
import { measureCollar } from "./photo-geometry";

/** A white frame with a grey "shirt" from `top` down, and a skin-toned neck above it. */
function frame(top: number, S = 300) {
  const data = new Uint8Array(S * S * 3).fill(255);
  const paint = (x0: number, y0: number, x1: number, y1: number, rgb: number[]) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data.set(rgb, (y * S + x) * 3);
  };
  paint(Math.round(S * 0.45), Math.round(S * 0.1), Math.round(S * 0.55), Math.round(top * S), [200, 160, 130]);
  paint(Math.round(S * 0.3), Math.round(top * S), Math.round(S * 0.7), S, [128, 128, 128]);
  return { data, width: S, height: S, channels: 3 };
}

describe("measureCollar", () => {
  it("finds where the garment meets the neck", () => {
    expect(measureCollar(frame(0.26))).toBeCloseTo(0.26, 2);
    expect(measureCollar(frame(0.35))).toBeCloseTo(0.35, 2);
  });

  it("returns null when there's no garment at the chest", () => {
    const blank = { data: new Uint8Array(300 * 300 * 3).fill(255), width: 300, height: 300, channels: 3 };
    expect(measureCollar(blank)).toBeNull();
  });
});
