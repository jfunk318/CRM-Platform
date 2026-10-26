// Page blocks. A store page is Markdown, with whole lines for widgets:
//   [[stores group="Schools" sort=sales limit=6 columns=3 layout=list filters status=all]]
//   [[items sort=featured limit=8 columns=4 featured]]
// The page builder edits blocks and writes them back as these lines, so a
// page can always be edited as plain text too. Pure, so it can be tested and
// used in the browser.

export type ShowcaseOptions = {
  group: string | null;
  sort: "newest" | "oldest" | "sales" | "name" | "closing";
  limit: number;
  columns: number;
  includeClosed: boolean;
  layout: "grid" | "list";
  /** A search box and group buttons for shoppers. */
  filters: boolean;
};

export type ItemsOptions = {
  sort: "featured" | "newest" | "name" | "price";
  limit: number;
  columns: number;
  featuredOnly: boolean;
};

export type PageBlock = { kind: "markdown"; source: string } | { kind: "stores"; options: ShowcaseOptions } | { kind: "items"; options: ItemsOptions };

export const SHOWCASE_SORTS = { newest: "Newest", oldest: "Oldest", sales: "Highest sales", name: "Name", closing: "Closing soon" } as const;
export const ITEM_SORTS = { featured: "Featured first", newest: "Newest", name: "Name", price: "Lowest price" } as const;

export const DEFAULT_SHOWCASE: ShowcaseOptions = { group: null, sort: "newest", limit: 12, columns: 4, includeClosed: false, layout: "grid", filters: false };
export const DEFAULT_ITEMS: ItemsOptions = { sort: "featured", limit: 8, columns: 4, featuredOnly: false };

const LINE = /^\s*\[\[(stores|items)([^\]]*)\]\]\s*$/;

/** `key=value`, `key="value with spaces"` and bare `flag` words. */
function args(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of raw.matchAll(/(\w+)(?:=(?:"([^"]*)"|(\S+)))?/g)) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? "true";
  return out;
}

const clamp = (v: string | undefined, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return v !== undefined && Number.isInteger(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

const pick = <T extends string>(v: string | undefined, allowed: Record<T, string>, d: T): T => (v && v in allowed ? (v as T) : d);

export function parseShowcase(raw: string): ShowcaseOptions {
  const o = args(raw);
  return {
    group: o.group?.trim() || null,
    sort: pick(o.sort, SHOWCASE_SORTS, "newest"),
    limit: clamp(o.limit, 1, 48, DEFAULT_SHOWCASE.limit),
    columns: clamp(o.columns, 1, 6, DEFAULT_SHOWCASE.columns),
    includeClosed: o.status === "all",
    layout: o.layout === "list" ? "list" : "grid",
    filters: o.filters === "true",
  };
}

export function parseItems(raw: string): ItemsOptions {
  const o = args(raw);
  return {
    sort: pick(o.sort, ITEM_SORTS, "featured"),
    limit: clamp(o.limit, 1, 48, DEFAULT_ITEMS.limit),
    columns: clamp(o.columns, 1, 6, DEFAULT_ITEMS.columns),
    featuredOnly: o.featured === "true",
  };
}

/** Split a page into Markdown and widget blocks. */
export function splitBlocks(body: string): PageBlock[] {
  const blocks: PageBlock[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.join("").trim()) blocks.push({ kind: "markdown", source: buf.join("\n").replace(/^\n+|\n+$/g, "") });
    buf = [];
  };
  for (const line of body.replace(/\r\n/g, "\n").split("\n")) {
    const m = LINE.exec(line);
    if (m) {
      flush();
      blocks.push(m[1] === "stores" ? { kind: "stores", options: parseShowcase(m[2]) } : { kind: "items", options: parseItems(m[2]) });
    } else buf.push(line);
  }
  flush();
  return blocks;
}

/** A widget's line, with only the options that differ from the defaults. */
export function blockLine(b: Exclude<PageBlock, { kind: "markdown" }>): string {
  const parts: string[] = [b.kind];
  if (b.kind === "stores") {
    const o = b.options;
    if (o.group) parts.push(`group="${o.group.replace(/["\]]/g, "")}"`);
    if (o.sort !== DEFAULT_SHOWCASE.sort) parts.push(`sort=${o.sort}`);
    if (o.limit !== DEFAULT_SHOWCASE.limit) parts.push(`limit=${o.limit}`);
    if (o.columns !== DEFAULT_SHOWCASE.columns) parts.push(`columns=${o.columns}`);
    if (o.layout !== "grid") parts.push(`layout=${o.layout}`);
    if (o.filters) parts.push("filters");
    if (o.includeClosed) parts.push("status=all");
  } else {
    const o = b.options;
    if (o.sort !== DEFAULT_ITEMS.sort) parts.push(`sort=${o.sort}`);
    if (o.limit !== DEFAULT_ITEMS.limit) parts.push(`limit=${o.limit}`);
    if (o.columns !== DEFAULT_ITEMS.columns) parts.push(`columns=${o.columns}`);
    if (o.featuredOnly) parts.push("featured");
  }
  return `[[${parts.join(" ")}]]`;
}

/** Blocks back to page text. */
export const joinBlocks = (blocks: PageBlock[]) =>
  blocks
    .map((b) => (b.kind === "markdown" ? b.source.replace(/^\n+|\n+$/g, "") : blockLine(b)))
    .filter((s) => s.trim())
    .join("\n\n");
