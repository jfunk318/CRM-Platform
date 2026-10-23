// Garment sizes in the order people expect to see them. Suppliers' own
// ordering isn't reliable (SanMar's SIZE_INDEX is 1 for most rows).
const ORDER = [
  "NB", "0-3M", "03M", "3-6M", "06M", "6M", "6-12M", "12M", "18M", "24M", "2T", "3T", "4T", "5T", "5/6T", "6T",
  "YXXS", "YXS", "YS", "YS/M", "YM", "YM/L", "YL", "YXL", "Y2XL",
  "XXS", "2XS", "XS", "XS/S", "S", "S/M", "M", "M/L", "L", "L/XL", "XL", "XL/2XL", "XXL", "2XL", "2XL/3XL", "XXXL", "3XL", "4XL", "5XL", "6XL", "7XL", "8XL", "9XL", "10XL",
  "ST", "MT", "LT", "XLT", "2XLT", "3XLT", "4XLT", "5XLT", "6XLT",
  "OSFA", "OSFM", "OS", "ONE SIZE",
];
const RANK = new Map(ORDER.map((s, i) => [s, i]));

/** A sort key for a size code; numeric sizes (waists, 30x32) follow the named ones. */
export function sizeRank(code: string): number {
  const c = code.trim().toUpperCase().replace(/\s+/g, " ");
  const known = RANK.get(c);
  if (known !== undefined) return known;
  const n = /^(\d+(?:\.\d+)?)(?:\s*X\s*(\d+))?/.exec(c);
  if (n) return 1000 + Number(n[1]) + (n[2] ? Number(n[2]) / 1000 : 0);
  return 10_000;
}

/** Size codes sorted by sizeRank, keeping the given order for ties. */
export const sortSizes = (codes: string[]) =>
  codes.map((code, i) => ({ code, i })).sort((a, b) => sizeRank(a.code) - sizeRank(b.code) || a.i - b.i).map((s) => s.code);

/** A whole-number position for a size (unknown sizes keep `index` order among themselves). */
export const sizeSortOrder = (code: string, index: number) => {
  const rank = sizeRank(code);
  return rank >= 10_000 ? 10_000_000 + index : Math.round(rank * 1000);
};
