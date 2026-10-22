import { describe, expect, it } from "vitest";
import { storeStatus } from "./settings";
import { parseShowcase, splitBlocks } from "./showcase";

describe("store showcase blocks", () => {
  it("splits a page into text and showcase blocks", () => {
    const blocks = splitBlocks("# Hi\n\nIntro\n\n[[stores]]\n\nMore\n[[stores group=\"High Schools\" sort=sales limit=3 columns=2 status=all]]");
    expect(blocks.map((b) => b.kind)).toEqual(["markdown", "stores", "markdown", "stores"]);
    expect(blocks[3]).toEqual({ kind: "stores", options: { group: "High Schools", sort: "sales", limit: 3, columns: 2, includeClosed: true } });
  });
  it("uses safe defaults for missing or odd options", () => {
    expect(parseShowcase("")).toEqual({ group: null, sort: "newest", limit: 12, columns: 4, includeClosed: false });
    expect(parseShowcase(" sort=random limit=500 columns=0")).toMatchObject({ sort: "newest", limit: 48, columns: 1 });
  });
  it("only treats a whole line as a showcase", () => {
    expect(splitBlocks("See [[stores]] here").map((b) => b.kind)).toEqual(["markdown"]);
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
