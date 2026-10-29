import { describe, expect, it } from "vitest";
import { locationKey, matchArea, mergeDecorations, placeDecoration, referenceWidths, type TargetArea } from "./apply";
import { bestFit, commonWidthIn, coverageOf, DEFAULT_GUIDES, estimateStitches, guideFor, guidesFrom, maxWidthIn, transferPlacement } from "./guides";
import { printSize } from "./placement";

const G = DEFAULT_GUIDES;
const area = (label: string, widthIn: number, heightIn: number, id = label): TargetArea => ({ id, label, widthIn, heightIn, x: 0.3, y: 0.2, w: 0.4, h: 0.5 });
const wide = { widthPx: 2000, heightPx: 1000 }; // 2:1 logo
const tall = { widthPx: 1000, heightPx: 2000 };

describe("placement guides", () => {
  it("find the guide from the area's name, longest keyword first", () => {
    expect(guideFor("Front / Left Chest", G)?.name).toBe("Left / right chest");
    expect(guideFor("Back / Full Back", G)?.name).toBe("Full back");
    expect(guideFor("Back / Upper", G)?.name).toBe("Full back"); // falls back to the view's name
    expect(guideFor("Front / Full Front", G)?.name).toBe("Full front");
    expect(guideFor("Left Sleeve", G)?.name).toBe("Sleeve");
    expect(guideFor("Inside / Tag", G)).toBeNull();
  });

  it("cap the size at the guide and the area, keeping the art's shape", () => {
    // A left-chest area drawn 6″ wide still gets a 4″ logo.
    expect(maxWidthIn(area("Front / Left Chest", 6, 6), wide, guideFor("Left Chest", G))).toBe(4);
    // A tall design is limited by height: 14″ tall → 7″ wide.
    expect(maxWidthIn(area("Front / Full Front", 12, 16), tall, guideFor("Full Front", G))).toBe(7);
    // No guide: the area itself.
    expect(maxWidthIn(area("Tag", 3, 3), wide, null)).toBe(3);
  });

  it("best fit centers across and follows the guide's alignment", () => {
    const chest = area("Front / Left Chest", 5, 5);
    const p = bestFit(chest, wide, G);
    expect(printSize(chest, p, wide).widthIn).toBeCloseTo(4);
    expect(p.x).toBeCloseTo(0.1);
    expect(p.y).toBe(0);
    const hat = area("Cap front", 5, 3);
    const h = bestFit(hat, wide, G);
    expect(printSize(hat, h, wide)).toMatchObject({ widthIn: 4.5, heightIn: 2.25 });
    expect(h.y).toBeCloseTo((1 - 2.25 / 3) / 2); // middle of the cap
  });

  it("transfer keeps the printed size and position in inches, shrinking only to fit", () => {
    const adult = area("Front / Full Front", 12, 14);
    const youth = area("Front / Full Front", 10, 12);
    // 8″ wide, 1″ right of center, 2″ down.
    const place = { x: (6 + 1 - 4) / 12, y: 2 / 14, w: 8 / 12, rotation: 0 };
    const t = transferPlacement(adult, place, youth, wide, G);
    expect(t.widthIn).toBeCloseTo(8);
    expect(t.shrunk).toBe(false);
    expect((t.place.x + t.place.w / 2) * 10 - 5).toBeCloseTo(1); // still 1″ right of center
    expect(t.place.y * 12).toBeCloseTo(2);
    const big = transferPlacement(adult, { x: 0, y: 0, w: 1, rotation: 0 }, youth, wide, G);
    expect(big).toMatchObject({ widthIn: 10, shrunk: true });
  });

  it("the common width fits every area", () => {
    expect(commonWidthIn([area("Full Back", 12, 14), area("Full Back", 10, 12)], wide, G)).toBe(10);
  });

  it("saved guides are checked, and fall back to the standard set", () => {
    expect(guidesFrom(null)).toBe(DEFAULT_GUIDES);
    expect(guidesFrom([{ name: "Chest", keywords: [" Chest "], maxWidthIn: 3.5, maxHeightIn: 3.5, align: "middle" }, { name: "Bad" }])).toEqual([
      { name: "Chest", keywords: ["chest"], maxWidthIn: 3.5, maxHeightIn: 3.5, align: "top" },
    ]);
  });
});

describe("stitch estimates", () => {
  it("follow the stitched area and the method's density", () => {
    // 4″ × 2″ at 50% coverage, 1800 per sq in → 7,200.
    expect(estimateStitches(4, 2, 0.5)).toBe(7200);
    expect(estimateStitches(4, 2, 0.5, 1500)).toBe(6000);
    // Bigger art, more stitches: price follows size.
    expect(estimateStitches(8, 4, 0.5)).toBeGreaterThan(estimateStitches(4, 2, 0.5));
    expect(estimateStitches(0.5, 0.5, 0.1)).toBe(1000); // a minimum
    expect(estimateStitches(4, 2, null)).toBe(8600); // unknown coverage assumes 60%
  });

  it("coverage counts the non-transparent pixels", () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    for (let p = 0; p < 8; p++) data[p * 4 + 3] = 255; // top half solid
    expect(coverageOf({ data, width: 4, height: 4 })).toBe(0.5);
  });
});

describe("applying one decoration to many items", () => {
  const sweat = [area("Front / Full Front", 12, 14, "a1"), area("Front / Left Chest", 4, 4, "a2"), area("Back / Full Back", 12, 14, "a3")];
  const youth = [area("Front / Full Front", 10, 12, "b1"), area("Front / Chest", 3.5, 3.5, "b2")];
  const art = { artworkFileId: "f", sourceFileId: null, edits: {}, widthPx: 2000, heightPx: 1000, x: 1 / 6, y: 0, w: 2 / 3, rotation: 0, coverage: 0.5 };
  const source = { methodId: "emb", areaId: "a1", location: "Front / Full Front", artwork: art, colors: "", stitches: "38000", widthIn: "8", heightIn: "4", stitchesSet: true, needsArtwork: false };

  it("matches locations by name, then area name, then guide", () => {
    expect(matchArea(youth, "Front / Full Front", G)?.id).toBe("b1");
    expect(matchArea(youth, "Front / Left Chest", G)?.id).toBe("b2"); // both chest areas
    expect(matchArea(youth, "Back / Full Back", G)).toBeNull();
  });

  it("same size: the designed size everywhere it fits; a typed stitch count holds while the size does", () => {
    const here = placeDecoration(source, sweat[0], sweat[0], { mode: "same", guides: G });
    expect(here.decoration).toMatchObject({ widthIn: "8", heightIn: "4", stitches: "38000", stitchesSet: true, areaId: "a1" });
    const kid = placeDecoration(source, sweat[0], youth[0], { mode: "same", guides: G });
    expect(kid.decoration).toMatchObject({ widthIn: "8", areaId: "b1", location: "Front / Full Front" });
    // Another location in same-size mode prints at the reference width.
    const chest = placeDecoration(source, sweat[0], youth[1], { mode: "same", guides: G, referenceWidthIn: 3.5 });
    expect(chest.decoration).toMatchObject({ widthIn: "3.5", heightIn: "1.75", stitchesSet: false });
    // Its stitches are re-estimated for the smaller size: 3.5 × 1.75 × 50% × 1800.
    expect(chest.decoration && chest.decoration.stitches).toBe("5500");
  });

  it("fit: the same share of the room on each product", () => {
    // 8″ of a 12″ allowance is two thirds; a youth front allows 10″ → 6.67″.
    const kid = placeDecoration(source, sweat[0], youth[0], { mode: "fit", guides: G });
    expect(Number(kid.decoration?.widthIn)).toBeCloseTo(6.67, 2);
  });

  it("reference widths are the largest that fits every item with that location", () => {
    expect(referenceWidths(["Front / Left Chest"], [sweat, youth], art, G).get(locationKey("Front / Left Chest"))).toBe(3.5);
  });

  it("merging replaces the decoration at the same location and leaves the rest", () => {
    const existing = [{ areaId: "a1", location: "Front / Full Front", tag: "old" }, { areaId: "a3", location: "Back / Full Back", tag: "back" }];
    const merged = mergeDecorations(existing, [{ areaId: "a1", location: "Front / Full Front", tag: "new" }, { areaId: "a2", location: "Front / Left Chest", tag: "chest" }]);
    expect(merged.map((d) => d.tag)).toEqual(["new", "back", "chest"]);
  });
});
