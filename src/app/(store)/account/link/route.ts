import { NextResponse } from "next/server";
import { requestOrigin } from "@/lib/business";
import { isOwnerPath, redeemSignInLink } from "@/lib/store/accounts";
import { getRequestStore } from "@/lib/store/resolve";
import { OrderError } from "@/lib/orders/service";

/** The emailed one-time sign-in link. */
export async function GET(req: Request) {
  const rs = await getRequestStore();
  const origin = await requestOrigin();
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const next = url.searchParams.get("next") ?? "/account";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  if (!rs || (rs.settings.accountMode === "GUEST_ONLY" && !isOwnerPath(safeNext))) return NextResponse.redirect(`${origin}/`);
  try {
    await redeemSignInLink(rs, token);
  } catch (e) {
    if (!(e instanceof OrderError)) throw e;
    return NextResponse.redirect(isOwnerPath(safeNext) ? `${origin}/owner/login?expired=1` : `${origin}/account/login?expired=1&next=${encodeURIComponent(safeNext)}`);
  }
  return NextResponse.redirect(`${origin}${safeNext}`);
}
