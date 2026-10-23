import { zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { cleanTitle, colorShade, readSanmarFile, splitBullets, styleSelected, summarize } from "./sanmar";
import { sampleCsv, tee } from "./sample";

const collect = async <T,>(it: AsyncIterable<T>) => {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
};

describe("SanMar rows", () => {
  it("cleans titles and splits run-together bullets", () => {
    expect(cleanTitle("Jerzees -  Dri-Power 50/50 Cotton/Poly T-Shirt.  29M", "Jerzees", "29M")).toBe("Dri-Power 50/50 Cotton/Poly T-Shirt");
    expect(cleanTitle("Port & Company Core Cotton Tee. PC54", "Port & Company", "PC54")).toBe("Core Cotton Tee");
    expect(cleanTitle("BELLA+CANVAS Unisex Jersey Short Sleeve Tee. BC3001", "Bella + Canvas", "BC3001")).toBe("Unisex Jersey Short Sleeve Tee");
    expect(cleanTitle("DISCONTINUEDAnvil Ladies V-Neck T-Shirt. 88VL", "Anvil", "88VL")).toBe("Ladies V-Neck T-Shirt");
    expect(cleanTitle("LIMITED EDITION Tommy Bahama 5 O'Clock Polo. T223508TB", "Tommy Bahama", "T223508TB")).toBe("5 O'Clock Polo");
    expect(cleanTitle("Gildan Ladies Long Sleeve Hooded T-Shirt. 887L", "Anvil", "887L")).toBe("Gildan Ladies Long Sleeve Hooded T-Shirt");
    expect(splitBullets("5.4-ounce (Oxford)Advanced moistureTear-away label")).toBe("5.4-ounce (Oxford)\nAdvanced moisture\nTear-away label");
  });
  it("guesses white, light and dark garments from the color name", () => {
    expect(colorShade("White")).toBe("WHITE");
    expect(colorShade("Jet Black")).toBe("DARK");
    expect(colorShade("True Navy")).toBe("DARK");
    expect(colorShade("Light Blue")).toBe("LIGHT");
    expect(colorShade("Athletic Heather")).toBe("LIGHT");
  });
});

describe("reading the file", () => {
  const csv = sampleCsv([...tee("PC54"), ...tee("OLD1", { status: "Discontinued", brand: "District", category: "Bags" })]);

  it("reads a CSV and a zip holding it the same way", async () => {
    const fromCsv = await collect(readSanmarFile(strToU8(csv), "SanMar_SDL_N.csv"));
    const fromZip = await collect(readSanmarFile(zipSync({ "SanMar_SDL_N.csv": strToU8(csv) }), "SanMar_SDL_N.zip"));
    expect(fromZip).toEqual(fromCsv);
    expect(fromCsv).toHaveLength(8);
    expect(fromCsv[0]).toMatchObject({ style: "PC54", name: "Core Cotton Tee", brand: "Port & Co", categories: ["T-Shirts", "Youth"], color: "Jet Black", supplierColor: "JET BLACK", size: "M", cost: { piece: 3.5, dozen: 3.5, case: 2.5 }, discontinued: false });
    expect(fromCsv[0].backImage).toBe("https://cdnm.sanmar.com/PC54_0_back.jpg");
  });

  it("rejects files that aren't SanMar's", async () => {
    await expect(collect(readSanmarFile(strToU8("a,b\n1,2\n"), "x.csv"))).rejects.toThrow(/doesn't look like SanMar/);
    await expect(collect(readSanmarFile(zipSync({ "readme.txt": strToU8("hi") }), "x.zip"))).rejects.toThrow(/no CSV/);
  });

  it("summarizes styles for choosing, and filters by brand, category and status", async () => {
    const s = await summarize(readSanmarFile(strToU8(csv), "f.csv"));
    expect(s.rows).toBe(8);
    expect(s.styles).toEqual([
      ["PC54", "Port & Co", ["T-Shirts", "Youth"], false, 2, 4],
      ["OLD1", "District", ["Bags"], true, 2, 4],
    ]);
    const o = { brands: null, categories: null, includeDiscontinued: false, cost: "piece" as const };
    expect(styleSelected({ brand: "District", categories: ["Bags"], discontinued: true }, o)).toBe(false);
    expect(styleSelected({ brand: "District", categories: ["Bags"], discontinued: true }, { ...o, includeDiscontinued: true, categories: ["Youth"] })).toBe(false);
    expect(styleSelected({ brand: "Port & Co", categories: ["T-Shirts", "Youth"], discontinued: false }, { ...o, brands: ["Port & Co"], categories: ["Youth"] })).toBe(true);
  });
});
