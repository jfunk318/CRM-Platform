import { timingSafeEqual } from "node:crypto";
import { runFollowUps } from "@/lib/crm/tasks";
import { runDueBatches } from "@/lib/store/batches";

/**
 * Everything that runs on a schedule: batching closed stores' orders and
 * quote follow-up tasks. Call it hourly with `Authorization: Bearer $CRON_SECRET`.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json({ batched: await runDueBatches(), followUps: await runFollowUps() });
}

// Schedulers that can only send GET (e.g. Vercel Cron) use the same check.
export const GET = POST;
