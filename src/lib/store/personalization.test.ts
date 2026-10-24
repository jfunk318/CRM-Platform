import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { checkPersonalization, parseRoster, personalizationLabel, rosterText } from "./personalization";

const opts = {
  nameMode: "OPTIONAL" as const,
  nameMaxLength: 10,
  namePrice: new Prisma.Decimal(5),
  numberMode: "REQUIRED" as const,
  numberMaxDigits: 2,
  numberPrice: new Prisma.Decimal(3),
};

describe("checking a shopper's name and number", () => {
  it("cleans them up and prices what's printed", () => {
    expect(checkPersonalization({ ...opts, nameMaxLength: 20 }, { name: "  O'Brien-Smith ", number: "07" })).toMatchObject({ name: "O'Brien-Smith", number: "07" });
    const r = checkPersonalization({ ...opts, nameMaxLength: 20 }, { name: " Mary  Jo ", number: "7" });
    expect([r.name, r.charge.toFixed(2)]).toEqual(["Mary Jo", "8.00"]);
    expect(checkPersonalization(opts, { number: "12" }).charge.toFixed(2)).toBe("3.00");
    expect(checkPersonalization({ ...opts, nameMaxLength: 20 }, { name: "José Núñez", number: "1" }).name).toBe("José Núñez");
  });
  it("ignores fields the item doesn't offer", () => {
    expect(checkPersonalization({ ...opts, nameMode: "OFF" }, { name: "Smith", number: "1" })).toMatchObject({ name: "", number: "1" });
  });
  it("refuses missing, too long or odd values", () => {
    expect(() => checkPersonalization(opts, { name: "Smith" })).toThrow(/Enter the number/);
    expect(() => checkPersonalization(opts, { name: "Bartholomew Jr", number: "1" })).toThrow(/up to 10/);
    expect(() => checkPersonalization(opts, { name: "<b>", number: "1" })).toThrow(/letters/);
    expect(() => checkPersonalization(opts, { number: "123" })).toThrow(/2 digits/);
    expect(() => checkPersonalization(opts, { number: "1a" })).toThrow(/digits/);
  });
  it("reads as NAME #12", () => {
    expect(personalizationLabel({ name: "Smith", number: "12" })).toBe("Smith #12");
    expect(personalizationLabel({ name: "", number: "3" })).toBe("#3");
  });
});

describe("rosters typed by staff", () => {
  it("reads size, name and number per line, with commas or spaces", () => {
    expect(parseRoster("L, Smith, 12\nxl Mary Jo 4\nM, Lee\n\nS 9\nL, Smith, 12", ["S", "M", "L", "XL"])).toEqual([
      { sizeCode: "L", name: "Smith", number: "12", qty: 2 },
      { sizeCode: "XL", name: "Mary Jo", number: "4", qty: 1 },
      { sizeCode: "M", name: "Lee", number: "", qty: 1 },
      { sizeCode: "S", name: "", number: "9", qty: 1 },
    ]);
  });
  it("says which line is wrong", () => {
    expect(() => parseRoster("L Smith 1\n3XL Lee", ["L"])).toThrow(/line 2: start with a size/);
    expect(() => parseRoster("L", ["L"])).toThrow(/line 1: add a name/);
  });
  it("writes a roster back out one piece per line", () => {
    expect(rosterText([{ sizeCode: "L", name: "Smith", number: "12", qty: 2 }, { sizeCode: "S", name: "", number: "9", qty: 1 }])).toBe("L, Smith, 12\nL, Smith, 12\nS, 9");
  });
});
