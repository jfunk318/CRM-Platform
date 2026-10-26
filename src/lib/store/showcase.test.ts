import { describe, expect, it } from "vitest";
import { storeStatus } from "./settings";
import { DEFAULT_ITEMS, DEFAULT_SHOWCASE, joinBlocks, parseItems, parseShowcase, splitBlocks } from "./showcase";

describe("page blocks", () => {
  it("splits a page into text, showcase and item blocks", () => {
    const blocks = splitBlocks('# Hi\n\nIntro\n\n[[stores]]\n\nMore\n[[stores group="High Schools" sort=sales limit=3 columns=2 status=all layout=list filters]]\n[[items featured sort=price]]');
    expect(blocks.map((b) => b.kind)).toEqual(["markdown", "stores", "markdown", "stores", "items"]);
    expect(blocks[3]).toEqual({ kind: "stores", options: { group: "High Schools", sort: "sales", limit: 3, columns: 2, includeClosed: true, layout: "list", filters: true } });
    expect(blocks[4]).toEqual({ kind: "items", options: { ...DEFAULT_ITEMS, sort: "price", featuredOnly: true } });
  });
  it("uses safe defaults for missing or odd options", () => {
    expect(parseShowcase("")).toEqual(DEFAULT_SHOWCASE);
    expect(parseShowcase(" sort=random limit=500 columns=0 layout=carousel")).toMatchObject({ sort: "newest", limit: 48, columns: 1, layout: "grid" });
    expect(parseItems("limit=x")).toEqual(DEFAULT_ITEMS);
  });
  it("only treats a whole line as a widget", () => {
    expect(splitBlocks("See [[stores]] here").map((b) => b.kind)).toEqual(["markdown"]);
  });
  it("writes blocks back as page text that reads the same", () => {
    const body = '# Welcome\n\nPick your team.\n\n[[stores group="Teams" sort=closing limit=6 layout=list filters]]\n\n[[items sort=name featured]]\n\nThanks!';
    expect(joinBlocks(splitBlocks(body))).toBe(body);
    expect(joinBlocks([{ kind: "stores", options: { ...DEFAULT_SHOWCASE, group: 'Odd "name"]' } }])).toBe('[[stores group="Odd name"]]');
    expect(splitBlocks(joinBlocks([{ kind: "stores", options: DEFAULT_SHOWCASE }]))).toEqual([{ kind: "stores", options: DEFAULT_SHOWCASE }]);
  });
});

describe("storeStatus", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  it("is open, scheduled or closed from the switch and dates", () => {
    expect(storeStatus({ active: true, opensAt: null, closesAt: null }, now).state).toBe("open");
    expect(storeStatus({ active: false, opensAt: null, closesAt: null }, now).state).toBe("closed");
    expect(storeStatus({ active: true, opensAt: new Date("2026-11-15T00:00:00Z"), closesAt: null }, now)).toEqual({ state: "scheduled", label: "Opens Nov 15" });
    expect(storeStatus({ active: true, opensAt: null, closesAt: new Date("2026-11-01T00:00:00Z") }, now).state).toBe("closed");
    expect(storeStatus({ active: true, opensAt: null, closesAt: new Date("2026-11-20T23:59:59Z") }, now).label).toBe("Open · closes Nov 20");
  });
});
