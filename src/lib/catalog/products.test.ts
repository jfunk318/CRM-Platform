import { describe, expect, it } from "vitest";
import { diffRows, slugify, variantSku } from "./products";

describe("slugify", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("Ladies Premium Cotton T-Shirt")).toBe("ladies-premium-cotton-t-shirt");
    expect(slugify("  Port & Company® Tee  ")).toBe("port-and-company-tee");
    expect(slugify("Café Crème")).toBe("cafe-creme");
  });
});

describe("variantSku", () => {
  it("joins style, color and size", () => {
    expect(variantSku("DM104L", "Heather Navy", "2XL")).toBe("DM104L-HEATHER-NAVY-2XL");
    expect(variantSku("pc54", "Athletic Hthr", "S")).toBe("PC54-ATHLETIC-HTHR-S");
  });
});

describe("diffRows", () => {
  it("splits rows into updates, creates and deletes", () => {
    const d = diffRows(["a", "b", "c"], [
      { id: "a", name: "Red" },
      { id: null, name: "Blue" },
      { id: "zzz", name: "Unknown id is treated as new" },
    ]);
    expect(d.update).toEqual([{ id: "a", name: "Red" }]);
    expect(d.create).toEqual([{ name: "Blue" }, { name: "Unknown id is treated as new" }]);
    expect(d.deleteIds).toEqual(["b", "c"]);
  });
});
