import path from "node:path";
import { Worker } from "node:worker_threads";

// Reads SanMar's product data download ("SDL": SanMar_SDL_N.csv, or the
// zip it comes in). One row per style, color and size, with costs, status,
// categories and links to SanMar's product photos.

export type SupplierRow = {
  style: string;
  name: string;
  brand: string;
  description: string;
  categories: string[];
  color: string;
  supplierColor: string; // the color name the supplier uses for ordering
  size: string;
  sizeOrder: number;
  cost: { piece: number | null; dozen: number | null; case: number | null };
  discontinued: boolean;
  externalId: string; // the supplier's id for this style/color/size
  gtin: string | null;
  frontImage: string | null;
  backImage: string | null;
  specSheetUrl: string | null;
};

const num = (v: string | undefined) => {
  const n = Number((v ?? "").replace(/[$,\s]/g, ""));
  return v && v.trim() !== "" && Number.isFinite(n) ? n : null;
};
const url = (v: string | undefined) => {
  const t = (v ?? "").trim();
  return /^https:\/\/\S+$/.test(t) ? t : null;
};
const clean = (v: string | undefined) => (v ?? "").replace(/\s+/g, " ").trim();

/** "Jerzees -  Dri-Power 50/50 Cotton/Poly T-Shirt.  29M" → "Dri-Power 50/50 Cotton/Poly T-Shirt" */
export function cleanTitle(title: string, brand: string, style: string): string {
  let t = clean(title);
  const dash = t.indexOf(" - ");
  if (dash > 0 && dash < 40) t = t.slice(dash + 3);
  const escaped = style.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  t = t.replace(new RegExp(`[.\\s]*\\b${escaped}\\s*$`, "i"), "");
  t = t.replace(/\.\s*$/, "").trim();
  // Status words SanMar puts in front of some titles ("DISCONTINUEDAnvil …"); the status is kept separately.
  t = t.replace(/^((DISCONTINUED|LIMITED EDITION)\s*)+/, "");
  // A leading brand name, however it's written ("BELLA+CANVAS" for Bella + Canvas).
  const words = t.split(" ");
  const key = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (let n = Math.min(4, words.length - 1); brand && n > 0; n--) {
    if (key(words.slice(0, n).join(" ")) === key(brand)) {
      t = words.slice(n).join(" ");
      break;
    }
  }
  return t || style;
}

/**
 * SanMar runs its bullet points together ("…performanceTear-away label…");
 * a capital straight after a lowercase letter or ")" starts a new bullet.
 */
export const splitBullets = (v: string) =>
  clean(v)
    .split(/(?<=[a-z)])(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");

/** SanMar packs several categories into one field: "T-Shirts ;Women's". */
export const splitCategories = (v: string) =>
  v
    .split(";")
    .map((c) => clean(c))
    .filter(Boolean);

/** Remembers the last answer: a style's rows repeat the same title and description. */
const memoLast = <A extends unknown[], R>(fn: (...a: A) => R) => {
  let key: string | null = null;
  let value: R;
  return (...a: A): R => {
    const k = a.join("\u0000");
    if (k !== key) {
      key = k;
      value = fn(...a);
    }
    return value;
  };
};

type RowText = { title: typeof cleanTitle; bullets: typeof splitBullets; categories: typeof splitCategories };
const plainText: RowText = { title: cleanTitle, bullets: splitBullets, categories: splitCategories };

export function sanmarRow(r: Record<string, string>, text: RowText = plainText): SupplierRow | null {
  const style = clean(r["STYLE#"]);
  const color = clean(r.COLOR_NAME);
  const size = clean(r.SIZE);
  if (!style || !color || !size) return null;
  const brand = clean(r.MILL);
  const status = clean(r.PRODUCT_STATUS).toLowerCase();
  return {
    style,
    name: text.title(r.PRODUCT_TITLE ?? "", brand, style),
    brand,
    description: text.bullets(r.PRODUCT_DESCRIPTION ?? ""),
    categories: text.categories(r.CATEGORY_NAME ?? ""),
    color,
    supplierColor: clean(r.SANMAR_MAINFRAME_COLOR) || color,
    size,
    sizeOrder: num(r.SIZE_INDEX) ?? 0,
    cost: { piece: num(r.PIECE_PRICE), dozen: num(r.DOZENS_PRICE), case: num(r.CASE_PRICE) },
    discontinued: status === "discontinued",
    externalId: clean(r.UNIQUE_KEY) || `${style}|${color}|${size}`,
    gtin: clean(r.GTIN) || null,
    frontImage: url(r.FRONT_MODEL_IMAGE_URL) ?? url(r.FRONT_FLAT_IMAGE_URL),
    backImage: url(r.BACK_MODEL_IMAGE_URL) ?? url(r.BACK_FLAT_IMAGE_URL),
    specSheetUrl: url(r.DECORATION_SPEC_SHEET),
  };
}

/** True if the header row looks like SanMar's SDL file. */
export const isSanmarHeader = (cols: string[]) => ["STYLE#", "COLOR_NAME", "SIZE", "PIECE_PRICE", "MILL"].every((c) => cols.includes(c));

export class ImportFileError extends Error {}

/** The SanMar columns the importer reads. */
const COLUMNS = [
  "STYLE#", "PRODUCT_TITLE", "MILL", "PRODUCT_DESCRIPTION", "CATEGORY_NAME", "COLOR_NAME", "SANMAR_MAINFRAME_COLOR", "SIZE", "SIZE_INDEX",
  "PIECE_PRICE", "DOZENS_PRICE", "CASE_PRICE", "PRODUCT_STATUS", "UNIQUE_KEY", "GTIN", "FRONT_MODEL_IMAGE_URL", "FRONT_FLAT_IMAGE_URL",
  "BACK_MODEL_IMAGE_URL", "BACK_FLAT_IMAGE_URL", "DECORATION_SPEC_SHEET",
];

type WorkerMessage = { header: string[] } | { rows: string[][] } | { done: true } | { error: string };

/**
 * Rows of a CSV (or the first CSV in a zip) as records of `columns`. The
 * parsing runs in a worker thread: a full SanMar file is ~15 s of work that
 * would otherwise hold up every other request.
 */
async function* readCsvRows(bytes: Uint8Array, fileName: string, columns: string[], checkHeader: (header: string[]) => void): AsyncGenerator<Record<string, string>> {
  // By path, not import: the worker runs as plain JavaScript outside the bundle.
  const worker = new Worker(path.join(process.cwd(), "src/lib/catalog/import/read-worker.mjs"), { workerData: { bytes, fileName, columns } });
  const queue: WorkerMessage[] = [];
  let wake: (() => void) | null = null;
  const push = (m: WorkerMessage) => {
    queue.push(m);
    wake?.();
    wake = null;
  };
  worker.on("message", push);
  worker.on("error", (e) => push({ error: e.message }));
  worker.on("exit", (code) => push(code === 0 ? { done: true } : { error: `The file reader stopped (${code})` }));
  let sawHeader = false;
  try {
    for (;;) {
      if (!queue.length) await new Promise<void>((r) => (wake = r));
      const m = queue.shift()!;
      if ("error" in m) throw new ImportFileError(m.error);
      if ("done" in m) break;
      if ("header" in m) {
        sawHeader = true;
        checkHeader(m.header);
        continue;
      }
      worker.postMessage("more");
      for (const r of m.rows) yield Object.fromEntries(columns.map((c, i) => [c, r[i]]));
      // Let other requests in between batches.
      await new Promise((r) => setImmediate(r));
    }
    if (!sawHeader) throw new ImportFileError("The file is empty");
  } finally {
    // Also stops the worker if the reader quit early.
    void worker.terminate();
  }
}

/** Every row of a SanMar file (SanMar_SDL_N.csv, or the zip it comes in). */
export async function* readSanmarFile(bytes: Uint8Array, fileName: string): AsyncGenerator<SupplierRow> {
  const check = (header: string[]) => {
    if (!isSanmarHeader(header)) throw new ImportFileError("That doesn't look like SanMar's product data file (SanMar_SDL_N)");
  };
  const text: RowText = { title: memoLast(cleanTitle), bullets: memoLast(splitBullets), categories: memoLast(splitCategories) };
  for await (const record of readCsvRows(bytes, fileName, COLUMNS, check)) {
    const row = sanmarRow(record, text);
    if (row) yield row;
  }
}

// ─── Summary for choosing what to import ────────────────────────────────

/** One entry per style: [style, brand, categories, discontinued, colors, skus]. */
export type StyleSummary = [string, string, string[], boolean, number, number];
export type FileSummary = { rows: number; styles: StyleSummary[] };

export async function summarize(rows: AsyncIterable<SupplierRow>): Promise<FileSummary> {
  const byStyle = new Map<string, { brand: string; categories: Set<string>; discontinued: boolean; colors: Set<string>; skus: number }>();
  let n = 0;
  for await (const r of rows) {
    n++;
    const s = byStyle.get(r.style) ?? { brand: r.brand, categories: new Set(), discontinued: true, colors: new Set(), skus: 0 };
    r.categories.forEach((c) => s.categories.add(c));
    // A style counts as discontinued only if every row of it is.
    s.discontinued &&= r.discontinued;
    s.colors.add(r.color);
    s.skus++;
    byStyle.set(r.style, s);
  }
  return {
    rows: n,
    styles: [...byStyle].map(([style, s]) => [style, s.brand, [...s.categories], s.discontinued, s.colors.size, s.skus]),
  };
}

export type ImportOptions = {
  brands: string[] | null; // null = every brand
  categories: string[] | null; // null = every category
  includeDiscontinued: boolean;
  cost: "piece" | "dozen" | "case";
};

/** Whether a style is in what the user chose to import. */
export function styleSelected(s: { brand: string; categories: string[]; discontinued: boolean }, o: ImportOptions): boolean {
  if (!o.includeDiscontinued && s.discontinued) return false;
  if (o.brands && !o.brands.includes(s.brand)) return false;
  if (o.categories && !s.categories.some((c) => o.categories!.includes(c))) return false;
  return true;
}

// ─── Colors ─────────────────────────────────────────────────────────────

const HEX: [RegExp, string][] = [
  [/\bwhite\b/, "#ffffff"],
  [/\bblack\b|jet\b/, "#111111"],
  [/\b(true )?navy\b/, "#1f2a44"],
  [/\broyal\b/, "#1d4fb8"],
  [/\b(carolina|light) blue\b|\bsky\b/, "#8fbce6"],
  [/\bred\b|cardinal|scarlet/, "#c8102e"],
  [/maroon|burgundy|cardinal/, "#6d1a2c"],
  [/forest|hunter|dark green/, "#1f4d2b"],
  [/kelly|irish green/, "#2e8b3e"],
  [/\bgreen\b/, "#3a7d44"],
  [/orange/, "#f26b1d"],
  [/gold|yellow|maize/, "#f2c230"],
  [/purple|violet/, "#5b2c83"],
  [/pink/, "#f19cbb"],
  [/brown|chocolate|coffee/, "#5b3a29"],
  [/charcoal|graphite|iron/, "#3d4045"],
  [/oxford|heather|grey|gray|ash|silver/, "#a5a8ab"],
  [/natural|cream|ivory|oatmeal|sand|khaki|tan/, "#e6dcc3"],
];

/** A rough swatch color from the color's name, for color dots. */
export function colorHex(name: string): string | null {
  const n = name.toLowerCase();
  return HEX.find(([re]) => re.test(n))?.[1] ?? null;
}

/** White, light or dark garment (drives the white underbase in pricing). */
export function colorShade(name: string): "WHITE" | "LIGHT" | "DARK" {
  const n = name.toLowerCase();
  if (/^(bright |optic |true )?white$/.test(n)) return "WHITE";
  if (/black|navy|charcoal|graphite|maroon|burgundy|forest|hunter|dark|deep|royal|purple|brown|chocolate|cardinal|red|kelly|green|iron|steel|denim|olive|espresso|coffee|eggplant/.test(n) && !/light|pale|pastel|heather grey|ice/.test(n)) {
    return "DARK";
  }
  return "LIGHT";
}
