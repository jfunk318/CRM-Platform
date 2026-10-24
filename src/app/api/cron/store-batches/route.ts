import { timingSafeEqual } from "node:crypto";
import { runDueBatches } from "@/lib/store/batches";

/**
 * Batch the orders of every store that has closed. Call it on a schedule
 * (hourly) with `Authorization: Bearer $CRON_SECRET`.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json({ batched: await runDueBatches() });
}

// Schedulers that can only send GET (e.g. Vercel Cron) use the same check.
export const GET = POST;
