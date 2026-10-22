import { describe, expect, it } from "vitest";
import { defaultMarkupTiers, quantityDiscounts } from "../../../prisma/seed-data";
import {
  blankUnitPrice,
  lookupDecorationPrice,
  type MethodPricing,
  priceLineItem,
  priceOrder,
  quantityDiscountPct,
  roundPrice,
  D,
} from "./index";

const screenPrint: MethodPricing = {
  code: "SCR",
  name: "Screen Printing",
  pricingModel: "PER_COLOR",
  minQty: 12,
  maxColors: 8,
  screenSetupFee: "20.00",
  chargeWhiteBaseScreen: true,
  useWhiteBaseOnDark: true,
  artworkFee: "35.00",
  digitizingFee: "0",
  digitizingFeePerInch: false,
  proofingFee: "0",
};

const scrCells = [
  { minQty: 12, dimensionMax: 1, unitPrice: "3.00" },
  { minQty: 12, dimensionMax: 2, unitPrice: "3.75" },
  { minQty: 12, dimensionMax: 4, unitPrice: "5.00" },
  { minQty: 48, dimensionMax: 1, unitPrice: "2.00" },
  { minQty: 48, dimensionMax: 2, unitPrice: "2.50" },
  { minQty: 48, dimensionMax: 4, unitPrice: "3.50" },
];

const markup = { mode: "MARKUP" as const, tiers: defaultMarkupTiers };

describe("blankUnitPrice", () => {
  it("applies Beeze markup tiers by wholesale cost", () => {
    expect(blankUnitPrice("2.50", defaultMarkupTiers).toFixed(2)).toBe("4.00"); // +60%
    expect(blankUnitPrice("3.00", defaultMarkupTiers).toFixed(2)).toBe("4.65"); // +55%
    expect(blankUnitPrice("12.00", defaultMarkupTiers).toFixed(2)).toBe("16.80"); // +40%
    expect(blankUnitPrice("25.00", defaultMarkupTiers).toFixed(2)).toBe("30.00"); // +20%
  });

  it("supports margin mode", () => {
    expect(blankUnitPrice("6.00", [{ costFrom: 0, costTo: null, pct: "0.40" }], "MARGIN").toFixed(2)).toBe(
      "10.00",
    );
  });

  it("throws when no tier covers the cost", () => {
    expect(() => blankUnitPrice("5", [{ costFrom: 0, costTo: "2.99", pct: "0.6" }])).toThrow(/No markup tier/);
  });
});

describe("lookupDecorationPrice", () => {
  it("picks the quantity row then the smallest covering column", () => {
    expect(lookupDecorationPrice(scrCells, 24, 2).toFixed(2)).toBe("3.75");
    expect(lookupDecorationPrice(scrCells, 24, 3).toFixed(2)).toBe("5.00");
    expect(lookupDecorationPrice(scrCells, 48, 1).toFixed(2)).toBe("2.00");
    expect(lookupDecorationPrice(scrCells, 500, 4).toFixed(2)).toBe("3.50");
  });

  it("rejects quantities below the first row and oversize dimensions", () => {
    expect(() => lookupDecorationPrice(scrCells, 6, 1)).toThrow(/quantity 6/);
    expect(() => lookupDecorationPrice(scrCells, 24, 6)).toThrow(/exceeds/);
  });

  it("handles flat tables", () => {
    expect(lookupDecorationPrice([{ minQty: 1, dimensionMax: null, unitPrice: "8" }], 3, null).toFixed(2)).toBe(
      "8.00",
    );
  });
});

describe("quantityDiscountPct", () => {
  const standard = quantityDiscounts.find((q) => q.name.startsWith("Standard"))!.tiers;
  it("uses the highest tier reached", () => {
    expect(quantityDiscountPct(standard, 4).toNumber()).toBe(0);
    expect(quantityDiscountPct(standard, 5).toNumber()).toBe(0.03);
    expect(quantityDiscountPct(standard, 12).toNumber()).toBe(0.05);
    expect(quantityDiscountPct(standard, 15).toNumber()).toBe(0.1);
  });
});

describe("roundPrice", () => {
  it("rounds to cents or up to .99", () => {
    expect(roundPrice(D("12.345")).toFixed(2)).toBe("12.35");
    expect(roundPrice(D("12.10"), "UP_TO_99").toFixed(2)).toBe("12.99");
    expect(roundPrice(D("13.00"), "UP_TO_99").toFixed(2)).toBe("13.99");
  });
});

describe("priceLineItem", () => {
  it("prices a 2-color front print on dark shirts with size-based costs", () => {
    const result = priceLineItem({
      garmentShade: "DARK",
      markup,
      sizes: [
        { sizeCode: "M", qty: 10, wholesaleCost: "3.00" },
        { sizeCode: "2XL", qty: 14, wholesaleCost: "5.00" },
      ],
      decorations: [{ location: "Front", method: screenPrint, priceCells: scrCells, colors: 2 }],
    });

    expect(result.issues).toEqual([]);
    expect(result.totalQty).toBe(24);
    // M: 3.00 × 1.55 = 4.65 + 3.75 print = 8.40; 2XL: 5.00 × 1.55 = 7.75 + 3.75 = 11.50
    expect(result.sizes.map((s) => s.unitPrice.toFixed(2))).toEqual(["8.40", "11.50"]);
    expect(result.merchandiseTotal.toFixed(2)).toBe("245.00"); // 84 + 161
    // 2 ink colors + white underbase on a dark garment = 3 screens × $20
    expect(result.fees).toEqual([
      expect.objectContaining({ type: "SCREEN_SETUP", amount: D("60.00"), description: "3 screens" }),
    ]);
    expect(result.total.toFixed(2)).toBe("305.00");
  });

  it("skips screen fees when screens are reused, and adds artwork", () => {
    const result = priceLineItem({
      garmentShade: "LIGHT",
      markup,
      sizes: [{ sizeCode: "L", qty: 12, wholesaleCost: "3.00" }],
      decorations: [
        { location: "Front", method: screenPrint, priceCells: scrCells, colors: 1, reuseScreens: true, needsArtwork: true },
      ],
    });
    expect(result.fees.map((f) => [f.type, f.amount.toFixed(2)])).toEqual([["ARTWORK", "35.00"]]);
  });

  it("applies quantity discounts to garment + decoration", () => {
    const result = priceLineItem({
      garmentShade: "WHITE",
      markup,
      quantityDiscountTiers: [{ minQty: 12, pct: "0.10" }],
      sizes: [{ sizeCode: "L", qty: 12, wholesaleCost: "3.00" }],
      decorations: [{ location: "Front", method: screenPrint, priceCells: scrCells, colors: 1, reuseScreens: true }],
    });
    // (4.65 + 3.00) × 0.90 = 6.885 → 6.89
    expect(result.sizes[0].unitPrice.toFixed(2)).toBe("6.89");
  });

  it("reports minimum quantity and color limits instead of throwing", () => {
    const result = priceLineItem({
      garmentShade: "LIGHT",
      markup,
      sizes: [{ sizeCode: "L", qty: 6, wholesaleCost: "3.00" }],
      decorations: [{ location: "Front", method: screenPrint, priceCells: scrCells, colors: 9 }],
    });
    expect(result.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(["BELOW_MIN_QTY", "TOO_MANY_COLORS", "NO_PRICE_ROW"]),
    );
  });

  it("uses a combined quantity for the price break when given", () => {
    const result = priceLineItem({
      garmentShade: "LIGHT",
      markup,
      sizes: [{ sizeCode: "L", qty: 12, wholesaleCost: "3.00" }],
      decorations: [
        { location: "Front", method: screenPrint, priceCells: scrCells, colors: 1, pricingQty: 60, reuseScreens: true },
      ],
    });
    expect(result.decorations[0].unitPrice.toFixed(2)).toBe("2.00");
  });

  it("charges embroidery digitizing per inch when configured", () => {
    const emb: MethodPricing = {
      ...screenPrint,
      code: "EMB",
      name: "Embroidery",
      pricingModel: "PER_STITCH",
      minQty: 1,
      maxColors: null,
      digitizingFee: "5.00",
      digitizingFeePerInch: true,
    };
    const result = priceLineItem({
      garmentShade: "DARK",
      markup,
      sizes: [{ sizeCode: "L", qty: 6, wholesaleCost: "10.00" }],
      decorations: [
        {
          location: "Left Chest",
          method: emb,
          priceCells: [{ minQty: 1, dimensionMax: 8000, unitPrice: "7.50" }],
          stitches: 6500,
          widthIn: "3.5",
          heightIn: "2",
          needsDigitizing: true,
        },
      ],
    });
    expect(result.issues).toEqual([]);
    expect(result.sizes[0].unitPrice.toFixed(2)).toBe("21.50"); // 14.00 + 7.50
    expect(result.fees).toEqual([expect.objectContaining({ type: "DIGITIZING", amount: D("20.00") })]); // ceil(3.5)=4 in
  });

  it("blocks blank sale when the product requires decoration", () => {
    const result = priceLineItem({
      garmentShade: "LIGHT",
      markup,
      allowBlankSale: false,
      sizes: [{ sizeCode: "L", qty: 1, wholesaleCost: "3.00" }],
      decorations: [],
    });
    expect(result.issues[0].code).toBe("BLANK_NOT_ALLOWED");
  });
});

describe("priceOrder", () => {
  const line = priceLineItem({
    garmentShade: "DARK",
    markup,
    sizes: [{ sizeCode: "M", qty: 24, wholesaleCost: "3.00" }],
    decorations: [{ location: "Front", method: screenPrint, priceCells: scrCells, colors: 2, needsArtwork: true }],
  });
  // 24 × 8.40 = 201.60 merchandise; screens 60.00; artwork 35.00

  it("adds rush, shipping, surcharge and tax per the rate's flags", () => {
    const totals = priceOrder({
      lines: [line],
      shipping: "15.00",
      rushFeePct: "0.10",
      paymentSurchargePct: "0.03",
      taxRates: [
        {
          name: "State",
          rate: "0.0625",
          taxShipping: false,
          taxArtworkFee: false,
          taxDigitizingFee: true,
          taxRushFee: true,
          taxScreenSetupFee: true,
          taxPaymentSurcharge: false,
        },
      ],
    });
    expect(totals.merchandise.toFixed(2)).toBe("201.60");
    expect(totals.rushFee.toFixed(2)).toBe("20.16");
    // 201.60 + 60 + 35 + 20.16 + 15 = 331.76; surcharge 3% = 9.95
    expect(totals.paymentSurcharge.toFixed(2)).toBe("9.95");
    expect(totals.subtotal.toFixed(2)).toBe("341.71");
    // taxable = 201.60 + 60 (screens) + 20.16 (rush) = 281.76 × 6.25% = 17.61
    expect(totals.taxes[0].taxable.toFixed(2)).toBe("281.76");
    expect(totals.tax.toFixed(2)).toBe("17.61");
    expect(totals.total.toFixed(2)).toBe("359.32");
  });

  it("charges no tax for exempt customers", () => {
    const totals = priceOrder({ lines: [line] });
    expect(totals.tax.toFixed(2)).toBe("0.00");
    expect(totals.total.toFixed(2)).toBe("296.60");
  });
});
