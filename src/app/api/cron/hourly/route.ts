import { timingSafeEqual } from "node:crypto";
import { runAllAutomations } from "@/lib/automation/engine";
import { runFollowUps } from "@/lib/crm/tasks";
import { runDueBatches } from "@/lib/store/batches";

/**
 * Everything that runs on a schedule: batching closed stores' orders, quote
 * follow-up tasks, and any automation events not yet handled (they normally
 * run right after the request that set them off). Call it hourly with `Authorization: Bearer $CRON_SECRET`.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json({ batched: await runDueBatches(), followUps: await runFollowUps(), automations: await runAllAutomations() });
}

// Schedulers that can only send GET (e.g. Vercel Cron) use the same check.
export const GET = POST;
