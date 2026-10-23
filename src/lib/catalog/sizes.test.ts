import { describe, expect, it } from "vitest";
import { sortSizes } from "./sizes";

describe("sortSizes", () => {
  it("puts garment sizes in the usual order", () => {
    expect(sortSizes(["2XL", "3XL", "4XL", "5XL", "L", "M", "S", "XL"])).toEqual(["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"]);
    expect(sortSizes(["L/XL", "S/M", "M/L"])).toEqual(["S/M", "M/L", "L/XL"]);
    expect(sortSizes(["XLT", "LT", "2XL", "L"])).toEqual(["L", "2XL", "LT", "XLT"]);
    expect(sortSizes(["YL", "YS", "YM", "YXS", "YXL"])).toEqual(["YXS", "YS", "YM", "YL", "YXL"]);
    expect(sortSizes(["5/6T", "2T", "4T", "3T", "12M", "06M"])).toEqual(["06M", "12M", "2T", "3T", "4T", "5/6T"]);
  });
  it("orders waist sizes by number and keeps unknown sizes in their original order at the end", () => {
    expect(sortSizes(["38", "30", "32x30", "32"])).toEqual(["30", "32", "32x30", "38"]);
    expect(sortSizes(["Zeta", "M", "Alpha", "OSFA"])).toEqual(["M", "OSFA", "Zeta", "Alpha"]);
  });
});
