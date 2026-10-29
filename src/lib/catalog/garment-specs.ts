// Supplier decoration specs: where a garment can be decorated and how big
// (from SanMar's Company Casuals "Decoration Spec Sheet"), and its size
// measurements, turned into print areas placed at life size on the model
// photos.
//
// SanMar shoots every garment at the same scale: an inch is ~1.9% of the
// square frame (collar to hem measured across adult, youth and ladies'
// styles), centered across, with the front collar ~26% down on an adult. Positions follow from measurements: left chest 3.75" off
// the center line and 3.5" below the collar, bottoms 2" above the hem, and
// so on. "Left" is the wearer's left: the right-hand side of a front photo.

export type SpecLocation = { code: string; name: string; widthIn: number; heightIn: number };
export type GarmentSpec = { style: string; locations: SpecLocation[]; chestIn: number | null; bodyLengthIn: number | null };
export type PlannedArea = { code: string; view: "Front" | "Back"; name: string; widthIn: number; heightIn: number; box: [number, number, number, number] };

const BASE = "https://catalog.companycasuals.com";

/** Page text without markup, scripts or extra whitespace. */
export function pageText(html: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", reg: "®", trade: "™" };
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (m, e: string) =>
      e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (named[e.toLowerCase()] ?? m),
    )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Decoration locations from a spec sheet's text: `LC Left Chest 4"H x 4"W`,
 * written loosely (`4"HX4"W`, `14"Hx 14"W`, `8"H x 14'W`, `(max size)`).
 */
export function parseDecorationSpec(text: string): SpecLocation[] {
  const start = text.indexOf("Decoration Dimensions");
  const end = text.indexOf("Decoration area is dependent");
  const part = text.slice(start < 0 ? 0 : start, end < 0 ? undefined : end);
  const re = /\b([A-Z]{2,4}) ([A-Z][A-Za-z/&'-]*(?: [A-Z][A-Za-z/&'-]*)*) (\d+(?:\.\d+)?)\s*["'″]\s*([HW])\s*[xX×]\s*(\d+(?:\.\d+)?)\s*["'″]?\s*([HW])/g;
  const out: SpecLocation[] = [];
  for (const m of part.matchAll(re)) {
    const [, code, name, a, aDim, b, bDim] = m;
    if (aDim === bDim) continue;
    const [h, w] = aDim === "H" ? [Number(a), Number(b)] : [Number(b), Number(a)];
    if (!(w > 0 && h > 0) || out.some((l) => l.code === code)) continue;
    out.push({ code, name: name.trim(), widthIn: w, heightIn: h });
  }
  return out;
}

const num = (s: string) => {
  const [whole, frac] = s.split(" ");
  const [n, d] = (frac ?? "").split("/").map(Number);
  return Number(whole) + (frac && d ? n / d : 0);
};

/** Chest width (laid flat) and body length for a medium, from the measurements table. */
export function parseMeasurements(text: string): { chestIn: number | null; bodyLengthIn: number | null } {
  const i = text.indexOf("Product Measurements");
  if (i < 0) return { chestIn: null, bodyLengthIn: null };
  const rest = text.slice(i + "Product Measurements".length).trim();
  // The size headings (S M L XL 2XL…, XS, LT…) run until the first row label.
  const sizes: string[] = [];
  for (const token of rest.split(" ")) {
    if (!/^[0-9]*[A-Z/]+$/.test(token)) break;
    sizes.push(token);
  }
  const pick = sizes.includes("M") ? sizes.indexOf("M") : Math.floor(sizes.length / 2);
  const row = (label: string) => {
    const at = rest.indexOf(label);
    if (at < 0 || !sizes.length) return null;
    const values = [...rest.slice(at + label.length).matchAll(/(\d+(?:\.\d+)?(?: \d+\/\d+)?)/g)].slice(0, sizes.length).map((m) => num(m[1]));
    return values.length === sizes.length ? values[pick] : null;
  };
  return { chestIn: row("Chest"), bodyLengthIn: row("Body Length") };
}

/** Fetch a style's decoration spec and measurements from Company Casuals (null if it isn't there). */
export async function fetchGarmentSpec(style: string, get: (url: string) => Promise<string> = defaultGet): Promise<GarmentSpec | null> {
  const results = await get(`${BASE}/search/results?q=${encodeURIComponent(style)}%3Arelevance&page=0`);
  // The first product link: /p/<id>_<color>.
  const m = /href=\\?"(\\?\/p\\?\/[A-Za-z0-9_%-]+)\\?"/.exec(results);
  if (!m) return null;
  const path = m[1].replace(/\\\//g, "/");
  const spec = pageText(await get(`${BASE}${path}/decorationSpecSheet`));
  // Make sure the page is for this style, not a near match.
  if (!new RegExp(`Decoration Spec Sheet ${style.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(spec)) return null;
  const measurements = parseMeasurements(pageText(await get(`${BASE}${path}/specSheetMeasurements`)));
  return { style, locations: parseDecorationSpec(spec), ...measurements };
}

async function defaultGet(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (print shop catalog sync)" }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

// ─── Placing the locations on the photos ────────────────────────────────

/** One inch as a share of the photo frame, the same for every style. */
const INCH = 0.019;
const CENTER = 0.505;
const COLLAR_FRONT = 0.257;
const COLLAR_BACK = 0.24;

/** Where a location sits, in inches: across from the center line (wearer's left is +), and down from the collar, or up from the hem to its bottom edge. */
type Template = { view: "Front" | "Back"; name: string; across: (chestHalf: number) => number } & ({ below: number } | { aboveHem: number });

const TEMPLATES: Record<string, Template> = {
  FC: { view: "Front", name: "Full Front", across: () => 0, below: 3 },
  LC: { view: "Front", name: "Left Chest", across: () => 3.75, below: 3.5 },
  RC: { view: "Front", name: "Right Chest", across: () => -3.75, below: 3.5 },
  LB: { view: "Front", name: "Left Bottom", across: () => 3.75, aboveHem: 2 },
  RB: { view: "Front", name: "Right Bottom", across: () => -3.75, aboveHem: 2 },
  PP: { view: "Front", name: "Pouch Pocket", across: () => 0, aboveHem: 2.5 },
  // The upper sleeve, just inside the chest's edge on the photo.
  LS: { view: "Front", name: "Left Sleeve", across: (c) => c - 0.25, below: 5.5 },
  RS: { view: "Front", name: "Right Sleeve", across: (c) => -(c - 0.25), below: 5.5 },
  BA: { view: "Back", name: "Full Back", across: () => 0, below: 3 },
  UB: { view: "Back", name: "Upper Back", across: () => 0, below: 1 },
  BB: { view: "Back", name: "Back Bottom", across: () => 0, aboveHem: 2 },
};

/** Hood locations in a spec mean a hooded garment. */
const HOOD_CODES = ["TH", "FH", "IH", "LHS", "RHS"];
/** On hooded garments the hood covers the top: front locations drop below its opening, back ones below its drape. */
const HOOD_DROP_IN = { Front: 2, Back: 5 };

/** Supplier codes this places (others, like hood sides or wrists, are listed but not placed). */
export const PLACED_CODES = Object.keys(TEMPLATES);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number) => Math.round(v * 1000) / 1000;

/** How far a measured front collar may move positions (more means a misread). */
const MAX_SHIFT = 0.12;

/**
 * Print areas for a garment's spec, positioned on its photos. With the
 * front photo's measured collar line (see photo-geometry), positions follow
 * the model's own framing: a youth model's collar sits lower than an
 * adult's, and the back photo is framed like the front.
 */
export function planAreas(spec: Pick<GarmentSpec, "locations" | "chestIn" | "bodyLengthIn">, photo: { collar?: number | null } = {}): PlannedArea[] {
  const chest = spec.chestIn && spec.chestIn > 8 ? spec.chestIn : 20;
  const inch = INCH;
  const body = spec.bodyLengthIn ?? chest * 1.45;
  const hooded = spec.locations.some((l) => HOOD_CODES.includes(l.code));
  // On a hoodie the measured line is the bottom of the hood opening, which
  // is where the drop already puts things.
  const expected = COLLAR_FRONT + (hooded ? HOOD_DROP_IN.Front * inch : 0);
  // Only garments have a collar (a blanket or bag has no chest or length measurement).
  const shift = (spec.chestIn || spec.bodyLengthIn) && photo.collar != null && Math.abs(photo.collar - expected) <= MAX_SHIFT ? photo.collar - expected : 0;
  return spec.locations.flatMap((loc): PlannedArea[] => {
    const t = TEMPLATES[loc.code];
    if (!t) return [];
    const collar = (t.view === "Front" ? COLLAR_FRONT : COLLAR_BACK) + shift;
    // Body length runs from the shoulder, about an inch above the collar.
    const hem = collar + (body - 1) * inch;
    const w = Math.min(loc.widthIn * inch, 0.9);
    const h = Math.min(loc.heightIn * inch, 0.9);
    const top =
      "below" in t
        ? collar + ((hooded ? HOOD_DROP_IN[t.view] : 0) + t.below) * inch
        : hem - (t.aboveHem + loc.heightIn) * inch;
    const x = clamp(CENTER + t.across(chest / 2) * inch - w / 2, 0, 1 - w);
    const y = clamp(top, 0, 1 - h);
    return [{ code: loc.code, view: t.view, name: t.name, widthIn: loc.widthIn, heightIn: loc.heightIn, box: [round(x), round(y), round(w), round(h)] }];
  });
}

// ─── Saving ─────────────────────────────────────────────────────────────

type AreaDb = {
  productView: { findMany(args: { where: { productId: string }; include: { areas: true } }): Promise<{ id: string; businessId: string; name: string; areas: { id: string; name: string; autoPlaced: boolean }[] }[]> };
  decorationArea: {
    update(args: { where: { id: string }; data: { widthIn: number; heightIn: number; x: number; y: number; w: number; h: number; autoPlaced: boolean } }): Promise<unknown>;
    create(args: { data: { businessId: string; viewId: string; name: string; widthIn: number; heightIn: number; x: number; y: number; w: number; h: number; autoPlaced: boolean } }): Promise<unknown>;
  };
};

/**
 * Put a garment's planned areas on its Front/Back views: areas still placed
 * automatically are moved and resized, missing ones are added, and areas
 * someone adjusted by hand are left alone.
 */
export async function applyPlannedAreas(db: AreaDb, productId: string, planned: PlannedArea[]) {
  const views = await db.productView.findMany({ where: { productId }, include: { areas: true } });
  const result = { added: 0, updated: 0, kept: 0, noView: 0 };
  for (const p of planned) {
    const view = views.find((v) => v.name.toLowerCase() === p.view.toLowerCase());
    if (!view) {
      result.noView++;
      continue;
    }
    const [x, y, w, h] = p.box;
    const data = { widthIn: p.widthIn, heightIn: p.heightIn, x, y, w, h, autoPlaced: true };
    const existing = view.areas.find((a) => a.name.toLowerCase() === p.name.toLowerCase());
    if (existing && !existing.autoPlaced) result.kept++;
    else if (existing) {
      await db.decorationArea.update({ where: { id: existing.id }, data });
      result.updated++;
    } else {
      await db.decorationArea.create({ data: { ...data, businessId: view.businessId, viewId: view.id, name: p.name } });
      result.added++;
    }
  }
  return result;
}
