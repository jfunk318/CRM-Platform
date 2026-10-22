// Store showcase blocks: a line like
//   [[stores group="Schools" sort=sales limit=6 columns=3 status=all]]
// on a page shows those stores as cards. Pure parsing, so it can be tested.

export type ShowcaseOptions = {
  group: string | null;
  sort: "newest" | "oldest" | "sales" | "name";
  limit: number;
  columns: number;
  includeClosed: boolean;
};

export type PageBlock = { kind: "markdown"; source: string } | { kind: "stores"; options: ShowcaseOptions };

const LINE = /^\s*\[\[stores([^\]]*)\]\]\s*$/;

export function parseShowcase(args: string): ShowcaseOptions {
  const opts: Record<string, string> = {};
  for (const m of args.matchAll(/(\w+)=(?:"([^"]*)"|(\S+))/g)) opts[m[1].toLowerCase()] = m[2] ?? m[3];
  const sort = ["newest", "oldest", "sales", "name"].includes(opts.sort) ? (opts.sort as ShowcaseOptions["sort"]) : "newest";
  const clamp = (v: string | undefined, lo: number, hi: number, d: number) => {
    const n = Number(v);
    return Number.isInteger(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  return {
    group: opts.group?.trim() || null,
    sort,
    limit: clamp(opts.limit, 1, 48, 12),
    columns: clamp(opts.columns, 1, 6, 4),
    includeClosed: opts.status === "all",
  };
}

/** Split a page into Markdown and showcase blocks. */
export function splitBlocks(body: string): PageBlock[] {
  const blocks: PageBlock[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.join("").trim()) blocks.push({ kind: "markdown", source: buf.join("\n") });
    buf = [];
  };
  for (const line of body.replace(/\r\n/g, "\n").split("\n")) {
    const m = LINE.exec(line);
    if (m) {
      flush();
      blocks.push({ kind: "stores", options: parseShowcase(m[1]) });
    } else buf.push(line);
  }
  flush();
  return blocks;
}
