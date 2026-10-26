import "server-only";
import type { BusinessDb } from "@/lib/db";

/** Crawlers and link previewers that run scripts still say who they are. */
export const looksLikeBot = (ua: string | null) => !ua || /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|curl|wget|python|axios/i.test(ua);

/** The UTC day a moment falls on, as stored. */
export const dayOf = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Count a page view, and a visit if it's the first page of the browser session. */
export async function recordVisit(db: BusinessDb, storeId: string, firstPage: boolean, now = new Date()) {
  const day = dayOf(now);
  await db.storeVisitDay.upsert({
    where: { storeId_day: { storeId, day } },
    create: { businessId: db.$businessId, storeId, day, visits: firstPage ? 1 : 0, views: 1 },
    update: { views: { increment: 1 }, ...(firstPage ? { visits: { increment: 1 } } : {}) },
  });
}

/** `since`: the first day in the period with visits counted (orders before it have no visits to compare with). */
export type VisitStats = { visits: number; views: number; daily: number[]; since: Date | null };

/** Visits and views per store over the last `days` days (today included), with daily visits for a chart. */
export async function visitStats(db: BusinessDb, storeIds: string[], days = 30, now = new Date()): Promise<Map<string, VisitStats>> {
  const today = dayOf(now);
  const from = new Date(today.getTime() - (days - 1) * 86_400_000);
  const rows = storeIds.length ? await db.storeVisitDay.findMany({ where: { storeId: { in: storeIds }, day: { gte: from } } }) : [];
  const out = new Map<string, VisitStats>(storeIds.map((id) => [id, { visits: 0, views: 0, daily: Array<number>(days).fill(0), since: null }]));
  for (const r of rows) {
    const s = out.get(r.storeId)!;
    s.visits += r.visits;
    s.views += r.views;
    const i = Math.round((r.day.getTime() - from.getTime()) / 86_400_000);
    if (i >= 0 && i < days) s.daily[i] += r.visits;
    if (!s.since || r.day < s.since) s.since = r.day;
  }
  return out;
}

/** Orders as a share of visits ("2.4%"), or "—" with no visits. */
export const conversion = (orders: number, visits: number) => (visits ? `${((orders / visits) * 100).toFixed(1)}%` : "—");
