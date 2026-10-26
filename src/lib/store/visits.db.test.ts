// Store visit counts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { makeTestBusiness } from "@/test/fixtures";
import { createAffiliateStore } from "./stores";
import { conversion, looksLikeBot, recordVisit, visitStats } from "./visits";

let t: Awaited<ReturnType<typeof makeTestBusiness>>;
beforeAll(async () => {
  t = await makeTestBusiness(`visits-${Date.now()}`);
});
afterAll(async () => {
  await t.cleanup();
  await prisma.$disconnect();
});

describe("store visits", () => {
  it("counts visits and page views per day, and sums the last 30 days", async () => {
    const store = await createAffiliateStore(t.db, { name: "Eagles", slug: `eagles-${Date.now()}` });
    const now = new Date("2026-11-20T15:00:00Z");
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
    await recordVisit(t.db, store.id, true, now);
    await recordVisit(t.db, store.id, false, now);
    await recordVisit(t.db, store.id, true, now);
    await recordVisit(t.db, store.id, true, daysAgo(3));
    await recordVisit(t.db, store.id, true, daysAgo(45)); // too long ago
    const s = (await visitStats(t.db, [store.id], 30, now)).get(store.id)!;
    expect([s.visits, s.views]).toEqual([3, 4]);
    expect(s.daily).toHaveLength(30);
    expect([s.daily[29], s.daily[26]]).toEqual([2, 1]);
    expect(s.since?.toISOString()).toBe("2026-11-17T00:00:00.000Z");
    expect(conversion(1, s.visits)).toBe("33.3%");
    expect(conversion(0, 0)).toBe("—");
  });
  it("leaves out obvious bots", () => {
    expect(looksLikeBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(looksLikeBot(null)).toBe(true);
    expect(looksLikeBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1")).toBe(false);
  });
});
