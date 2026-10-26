import { getRequestStore } from "@/lib/store/resolve";
import { looksLikeBot, recordVisit } from "@/lib/store/visits";

/** The store pages' visit counter (see VisitBeacon). */
export async function POST(req: Request) {
  const rs = await getRequestStore();
  if (!rs || looksLikeBot(req.headers.get("user-agent"))) return new Response(null, { status: 204 });
  let first = false;
  try {
    first = (await req.json())?.first === true;
  } catch {
    // An empty or odd body still counts as a view.
  }
  await recordVisit(rs.db, rs.store.id, first);
  return new Response(null, { status: 204 });
}
