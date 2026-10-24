import { describe, expect, it } from "vitest";
import { clampPlacement, dpiRating, effectiveDpi, fitPlacement, photoRect, printSize } from "./placement";
import { applyEdits, edgeColor, hexToRgb, invert, oneColor, palette, type Raster, removeBackground, replaceColors, rgbToHex, trim, visibleBounds } from "./raster";

/** A test image from rows of characters, one character per pixel. */
function draw(rows: string[], colors: Record<string, string>): Raster {
  const height = rows.length, width = rows[0].length;
  const data = new Uint8ClampedArray(width * height * 4);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const i = (y * width + x) * 4;
      if (ch === ".") return; // transparent
      const [r, g, b] = hexToRgb(colors[ch]);
      data.set([r, g, b, 255], i);
    }),
  );
  return { data, width, height };
}
const alphaRows = (img: Raster) =>
  Array.from({ length: img.height }, (_, y) => Array.from({ length: img.width }, (_, x) => (img.data[(y * img.width + x) * 4 + 3] > 0 ? "#" : ".")).join(""));
const pixel = (img: Raster, x: number, y: number) => rgbToHex([...img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 3)] as [number, number, number]);

// A red "O" on white: the white inside the O isn't connected to the edge.
const logo = draw(
  [
    "WWWWWWW",
    "WRRRRRW",
    "WRWWWRW",
    "WRWWWRW",
    "WRRRRRW",
    "WWWWWWW",
  ],
  { W: "#FFFFFF", R: "#CC0000" },
);

describe("background removal", () => {
  it("finds the background from the edges", () => {
    expect(rgbToHex(edgeColor(logo)!)).toBe("#FFFFFF");
  });
  it("clears background connected to the edge, keeping the inside of the art", () => {
    expect(alphaRows(removeBackground(logo, { tolerance: 10 }))).toEqual([".......", ".#####.", ".#####.", ".#####.", ".#####.", "......."]);
  });
  it("can clear that color everywhere", () => {
    expect(alphaRows(removeBackground(logo, { tolerance: 10, everywhere: true }))).toEqual([".......", ".#####.", ".#...#.", ".#...#.", ".#####.", "......."]);
  });
  it("trims to the visible art", () => {
    const t = trim(removeBackground(logo, { tolerance: 10 }));
    expect([t.width, t.height]).toEqual([5, 4]);
    expect(visibleBounds(draw(["..", ".."], {}))).toBeNull();
  });
});

describe("colors", () => {
  const two = draw(["RRRRBB", "RRRRBB", "....BB"], { R: "#CC0000", B: "#0000CC" });
  it("lists the colors in the art, most used first, ignoring transparency", () => {
    expect(palette(two).map((p) => [p.hex, Math.round(p.share * 100)])).toEqual([
      ["#CC0000", 57],
      ["#0000CC", 43],
    ]);
  });
  it("merges near-identical shades and ignores specks", () => {
    const noisy = draw(["AAAAAAAAAB", "AAAAAAAAAC"], { A: "#CC0000", B: "#C80404", C: "#00FF00" });
    expect(palette(noisy, { minShare: 0.1 }).map((p) => p.hex)).toEqual(["#CC0000"]);
  });
  it("swaps one color and leaves the rest", () => {
    const out = replaceColors(two, ["#CC0000", "#0000CC"], { "#0000CC": "#FFFFFF" });
    expect([pixel(out, 0, 0), pixel(out, 5, 0)]).toEqual(["#CC0000", "#FFFFFF"]);
  });
  it("makes everything one color, or inverts it", () => {
    expect(palette(oneColor(two, "#111111")).map((p) => p.hex)).toEqual(["#111111"]);
    expect(pixel(invert(two), 0, 0)).toBe("#33FFFF");
  });
  it("applies a color swap chosen from a slightly different palette", () => {
    const out = applyEdits(two, { replace: { "#0202CA": "#FFFFFF" } });
    expect([pixel(out, 0, 0), pixel(out, 5, 0)]).toEqual(["#CC0000", "#FFFFFF"]);
  });
  it("applies a set of edits in order", () => {
    const out = applyEdits(logo, { removeBg: { tolerance: 10, everywhere: true }, trim: true, oneColor: "#FFFFFF" });
    expect([out.width, out.height]).toEqual([5, 4]);
    expect(palette(out).map((p) => p.hex)).toEqual(["#FFFFFF"]);
  });
});

describe("placement", () => {
  const area = { widthIn: 12, heightIn: 14, x: 0.3, y: 0.2, w: 0.4, h: 0.5 };
  const wide = { widthPx: 3000, heightPx: 1500 };
  const tall = { widthPx: 1000, heightPx: 2000 };
  it("fits artwork as large as the area allows, centered at the top", () => {
    expect(fitPlacement(area, wide)).toEqual({ x: 0, y: 0, w: 1, rotation: 0 });
    const p = fitPlacement(area, tall); // 7 × 14 in
    expect(printSize(area, p, tall)).toEqual({ widthIn: 7, heightIn: 14 });
    expect(p.x).toBeCloseTo(5 / 24);
  });
  it("keeps artwork inside the area", () => {
    expect(clampPlacement(area, { x: 0.9, y: -1, w: 2, rotation: -90 }, wide)).toEqual({ x: 0, y: 0, w: 1, rotation: 270 });
    const p = clampPlacement(area, { x: 0, y: 0.9, w: 0.5, rotation: 0 }, wide); // 6 × 3 in
    expect(p.y).toBeCloseTo(11 / 14);
  });
  it("rates print resolution at the placed size", () => {
    expect(effectiveDpi(wide, 10)).toBe(300);
    expect(dpiRating(300, { minDpi: 150, perfectDpi: 300 })).toBe("good");
    expect(dpiRating(200, {})).toBe("ok");
    expect(dpiRating(72, { minDpi: 100 })).toBe("low");
  });
  it("places the artwork on the product photo", () => {
    const r = photoRect(area, { x: 0.25, y: 0, w: 0.5, rotation: 0 }, wide); // 6 × 3 in in a 12 × 14 in area
    expect(r.left).toBeCloseTo(0.4);
    expect(r.top).toBeCloseTo(0.2);
    expect(r.width).toBeCloseTo(0.2);
    expect(r.height).toBeCloseTo(0.1); // half as tall as wide, like the art
  });
});
