import { describe, expect, it } from "vitest";
import { parseDiscountTiers, parseMarkupTiers, parsePriceGrid } from "./validate";
import { percent, toPercentInput } from "./form";

describe("parseMarkupTiers", () => {
  it("accepts a flat 40% markup", () => {
    const tiers = parseMarkupTiers(["0"], [""], ["40"]);
    expect(tiers).toHaveLength(1);
    expect(tiers[0].pct.toNumber()).toBe(0.4);
    expect(tiers[0].costTo).toBeNull();
  });

  it("accepts contiguous tiers in any order and ignores blank rows", () => {
    const tiers = parseMarkupTiers(["10.00", "0", ""], ["", "9.99", ""], ["30", "40%", ""]);
    expect(tiers.map((t) => t.costFrom.toFixed(2))).toEqual(["0.00", "10.00"]);
  });

  it.each([
    [["1"], [""], ["40"], /start at \$0/],
    [["0", "5"], ["9.99", ""], ["40", "30"], /overlaps/],
    [["0", "12"], ["9.99", ""], ["40", "30"], /Gap/],
    [["0", "10"], ["", ""], ["40", "30"], /Only the last tier/],
    [["0"], ["9.99"], ["40"], /upper limit blank/],
    [["0"], [""], ["140"], /over 100%/],
    [[], [], [], /at least one/],
  ])("rejects bad tiers %#", (from, to, pct, err) => {
    expect(() => parseMarkupTiers(from, to, pct)).toThrow(err);
  });
});

describe("parseDiscountTiers", () => {
  it("sorts and converts percentages", () => {
    const tiers = parseDiscountTiers(["10", "5"], ["5", "3"]);
    expect(tiers.map((t) => [t.minQty, t.pct.toNumber()])).toEqual([
      [5, 0.03],
      [10, 0.05],
    ]);
  });
  it("rejects duplicates and fractions", () => {
    expect(() => parseDiscountTiers(["5", "5"], ["1", "2"])).toThrow(/twice/);
    expect(() => parseDiscountTiers(["5.5"], ["1"])).toThrow(/whole number/);
  });
});

describe("parsePriceGrid", () => {
  const grid = (quantities: string[], dimensions: string[], prices: string[][]) =>
    JSON.stringify({ quantities, dimensions, prices });

  it("turns a grid into cells, skipping blanks", () => {
    const cells = parsePriceGrid(grid(["12", "48"], ["1", "2"], [["3.00", "3.75"], ["2.00", ""]]), false);
    expect(cells.map((c) => [c.minQty, c.dimensionMax?.toNumber(), c.unitPrice.toFixed(2)])).toEqual([
      [12, 1, "3.00"],
      [12, 2, "3.75"],
      [48, 1, "2.00"],
    ]);
  });

  it("uses a null dimension for flat tables", () => {
    const cells = parsePriceGrid(grid(["1"], [""], [["8"]]), true);
    expect(cells[0].dimensionMax).toBeNull();
  });

  it("rejects duplicates, zero quantities and empty tables", () => {
    expect(() => parsePriceGrid(grid(["12", "12"], ["1"], [["1"], ["2"]]), false)).toThrow(/different/);
    expect(() => parsePriceGrid(grid(["12"], ["1", "1"], [["1", "2"]]), false)).toThrow(/different/);
    expect(() => parsePriceGrid(grid(["0"], ["1"], [["1"]]), false)).toThrow(/at least 1/);
    expect(() => parsePriceGrid(grid(["12"], ["1"], [[""]]), false)).toThrow(/at least one price/);
    expect(() => parsePriceGrid("{bad", false)).toThrow(/unreadable/);
  });
});

describe("percent helpers", () => {
  it("round-trips", () => {
    expect(toPercentInput(percent("12.5", "x"))).toBe("12.5");
  });
});
