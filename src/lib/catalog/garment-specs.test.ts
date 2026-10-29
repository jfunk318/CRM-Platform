import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fetchGarmentSpec, pageText, parseDecorationSpec, parseMeasurements, planAreas } from "./garment-specs";

const fixture = (name: string) => readFileSync(join(__dirname, "__fixtures__", name), "utf8");

describe("decoration spec sheets", () => {
  it("reads every location and its maximum size (PC54)", () => {
    const spec = parseDecorationSpec(fixture("pc54-decoration.txt"));
    expect(spec.map((l) => `${l.code} ${l.name} ${l.widthIn}x${l.heightIn}`)).toEqual([
      "FC Full Chest 12x18",
      "LB Left Bottom 4x4",
      "LC Left Chest 4x4",
      "RB Right Bottom 4x4",
      "RC Right Chest 4x4",
      "BA Back 14x20",
      "BB Back Bottom 14x6",
      "UB Upper Back 12x4",
      "LS Left Shoulder 4x4",
      "RS Right Shoulder 4x4",
    ]);
  });

  it("copes with the loose ways sizes are written (hoodie, hat)", () => {
    const hoodie = parseDecorationSpec(
      'Front Decoration Dimensions FC Full Chest 14"Hx 14"W Primary LC Left Chest 4"HX4"W PP Pouch Pocket 8"H x 7"W Back Decoration Dimensions UB Upper Back 8"H x 14\'W Decoration area is dependent',
    );
    expect(hoodie.map((l) => [l.code, l.widthIn, l.heightIn])).toEqual([["FC", 14, 14], ["LC", 4, 4], ["PP", 7, 8], ["UB", 14, 8]]);
    expect(parseDecorationSpec('Front Decoration Dimensions FPN Front Panel 2.5"H x 6"W (max size) Primary Decoration area is dependent')).toEqual([
      { code: "FPN", name: "Front Panel", widthIn: 6, heightIn: 2.5 },
    ]);
  });

  it("reads a medium's chest width and body length", () => {
    expect(parseMeasurements(fixture("pc54-measurements.txt"))).toEqual({ chestIn: 20, bodyLengthIn: 29 });
    expect(parseMeasurements("Product Measurements XS S L Body Length 26 27 1/2 29 Chest 17 18 19")).toEqual({ chestIn: 18, bodyLengthIn: 27.5 });
    expect(parseMeasurements("no table here")).toEqual({ chestIn: null, bodyLengthIn: null });
  });

  it("cleans page markup", () => {
    expect(pageText("<p>Port &amp; Co&#174;</p><script>x()</script> <b>Tee</b>")).toBe("Port & Co® Tee");
  });
});

describe("placing spec locations on the photos", () => {
  const areas = planAreas({ locations: parseDecorationSpec(fixture("pc54-decoration.txt")), chestIn: 20, bodyLengthIn: 29 });
  const box = (name: string) => areas.find((a) => a.name === name)!;

  it("puts the chests on the wearer's left and right, 3.75\" off center and 3.5\" below the collar, at life size", () => {
    // Left chest: the right-hand side of a front photo.
    expect(box("Left Chest")).toMatchObject({ view: "Front", widthIn: 4, heightIn: 4, box: [0.54, 0.327, 0.08, 0.08] });
    expect(box("Right Chest").box).toEqual([0.39, 0.327, 0.08, 0.08]);
    // Their centers match the shop's guide: ~58% and ~43% across, ~37% down.
    const center = (b: number[]) => [b[0] + b[2] / 2, b[1] + b[3] / 2];
    expect(center(box("Left Chest").box)[0]).toBeCloseTo(0.58, 2);
    expect(center(box("Right Chest").box)[0]).toBeCloseTo(0.43, 2);
    expect(center(box("Left Chest").box)[1]).toBeCloseTo(0.367, 2);
  });

  it("sizes full front and back from the spec, bottoms above the hem, sleeves past the chest", () => {
    expect(box("Full Front")).toMatchObject({ widthIn: 12, heightIn: 18, box: [0.385, 0.317, 0.24, 0.36] });
    expect(box("Full Back")).toMatchObject({ view: "Back", widthIn: 14, heightIn: 20 });
    expect(box("Upper Back").box[1]).toBeCloseTo(0.26, 3);
    // Hem at 28" below the collar; bottoms end 2" above it.
    const lb = box("Left Bottom").box;
    expect(lb[1] + lb[3]).toBeCloseTo(0.257 + 28 * 0.02 - 2 * 0.02, 3);
    expect(box("Left Sleeve").box[0]).toBeGreaterThan(box("Left Chest").box[0]);
    expect(box("Right Sleeve").box[0]).toBeLessThan(box("Right Chest").box[0]);
    expect(areas.every((a) => a.box.every((v) => v >= 0 && v <= 1))).toBe(true);
  });

  it("on hooded garments, drops chest and back locations below the hood but measures bottoms from the hem", () => {
    const locations = [
      { code: "LC", name: "Left Chest", widthIn: 4, heightIn: 4 },
      { code: "PP", name: "Pouch Pocket", widthIn: 7, heightIn: 8 },
      { code: "UB", name: "Upper Back", widthIn: 14, heightIn: 8 },
    ];
    const plain = planAreas({ locations, chestIn: 22, bodyLengthIn: 28 });
    const hood = planAreas({ locations: [...locations, { code: "FH", name: "Front Hood", widthIn: 4, heightIn: 3 }], chestIn: 22, bodyLengthIn: 28 });
    const top = (list: typeof plain, name: string) => list.find((a) => a.name === name)!.box[1];
    // A 22" chest: 0.4 ÷ 22 of the frame per inch; 2" lower in front, 5" at the back.
    expect(top(hood, "Left Chest") - top(plain, "Left Chest")).toBeCloseTo((2 * 0.4) / 22, 2);
    expect(top(hood, "Upper Back") - top(plain, "Upper Back")).toBeCloseTo((5 * 0.4) / 22, 2);
    expect(top(hood, "Pouch Pocket")).toBe(top(plain, "Pouch Pocket"));
  });

  it("scales to the style's own chest, so youth logos aren't drawn too small", () => {
    const lc = [{ code: "LC", name: "Left Chest", widthIn: 4, heightIn: 4 }];
    expect(planAreas({ locations: lc, chestIn: 16, bodyLengthIn: 22 })[0].box[2]).toBeCloseTo(0.1, 3);
    expect(planAreas({ locations: lc, chestIn: 20, bodyLengthIn: 29 })[0].box[2]).toBeCloseTo(0.08, 3);
  });

  it("leaves out locations it can't place (hood sides, wrists, hat panels)", () => {
    expect(planAreas({ locations: [{ code: "LHS", name: "Left Hood Side", widthIn: 5, heightIn: 10 }], chestIn: null, bodyLengthIn: null })).toEqual([]);
  });
});

describe("fetching a style's spec", () => {
  it("finds the style's page and reads both sheets", async () => {
    const pages: Record<string, string> = {
      "https://catalog.companycasuals.com/search/results?q=PC54%3Arelevance&page=0": '{"productListerHtml": "<a href=\\"\\/p\\/3985_AquaticBl\\" title=\\"Tee\\">"}',
      "https://catalog.companycasuals.com/p/3985_AquaticBl/decorationSpecSheet": fixture("pc54-decoration.txt"),
      "https://catalog.companycasuals.com/p/3985_AquaticBl/specSheetMeasurements": fixture("pc54-measurements.txt"),
    };
    const spec = await fetchGarmentSpec("PC54", async (url) => pages[url] ?? "");
    expect(spec).toMatchObject({ style: "PC54", chestIn: 20, bodyLengthIn: 29 });
    expect(spec?.locations).toHaveLength(10);
    // A search that lands on another style's page isn't used.
    expect(await fetchGarmentSpec("PC55", async (url) => (url.includes("search") ? pages[Object.keys(pages)[0]] : pages[url.replace("PC55", "PC54")] ?? fixture("pc54-decoration.txt")))).toBeNull();
  });
});
