// A tiny made-up file in SanMar's SDL layout, for tests.
const HEADER = ["UNIQUE_KEY", "PRODUCT_TITLE", "PRODUCT_DESCRIPTION", "STYLE#", "CATEGORY_NAME", "COLOR_NAME", "SIZE", "SIZE_INDEX", "PIECE_PRICE", "DOZENS_PRICE", "CASE_PRICE", "SANMAR_MAINFRAME_COLOR", "MILL", "PRODUCT_STATUS", "FRONT_MODEL_IMAGE_URL", "BACK_MODEL_IMAGE_URL", "FRONT_FLAT_IMAGE_URL", "BACK_FLAT_IMAGE_URL", "DECORATION_SPEC_SHEET", "GTIN"];

export type SampleRow = Partial<Record<(typeof HEADER)[number], string>>;

const q = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function sampleCsv(rows: SampleRow[]): string {
  return "﻿" + [HEADER.join(","), ...rows.map((r) => HEADER.map((h) => q(r[h] ?? "")).join(","))].join("\r\n") + "\r\n";
}

/** One style in two colors and two sizes. */
export function tee(style: string, o: { brand?: string; piece?: string; status?: string; colors?: string[]; category?: string } = {}): SampleRow[] {
  const brand = o.brand ?? "Port & Co";
  return (o.colors ?? ["Jet Black", "White"]).flatMap((color, ci) =>
    // Listed M before S, as supplier files sometimes do; the import sorts them.
    ["M", "S"].map((size, si) => ({
      UNIQUE_KEY: `${style}-${ci}-${si}`,
      PRODUCT_TITLE: `${brand} -  Core Cotton Tee.  ${style}`,
      PRODUCT_DESCRIPTION: "5.4-ounce cottonTear-away label",
      "STYLE#": style,
      CATEGORY_NAME: o.category ?? "T-Shirts ;Youth",
      COLOR_NAME: color,
      SIZE: size,
      SIZE_INDEX: String(si + 2),
      PIECE_PRICE: o.piece ?? "3.50",
      DOZENS_PRICE: o.piece ?? "3.50",
      CASE_PRICE: "2.50",
      SANMAR_MAINFRAME_COLOR: color.toUpperCase(),
      MILL: brand,
      PRODUCT_STATUS: o.status ?? "Regular",
      FRONT_MODEL_IMAGE_URL: `https://cdnm.sanmar.com/${style}_${ci}_front.jpg`,
      BACK_MODEL_IMAGE_URL: `https://cdnm.sanmar.com/${style}_${ci}_back.jpg `,
      DECORATION_SPEC_SHEET: "https://www.sanmar.com/p/1/decorationSpecSheet",
    })),
  );
}
