import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { getRequestBusiness } from "@/lib/business";
import { forBusiness } from "@/lib/db";

/** How many store owners' requests are new, for the live flag in the back office. */
export async function GET() {
  const [staff, business] = [await getCurrentStaff(), await getRequestBusiness()];
  if (!staff || !business || !hasAnyRole(staff.roles, ["STORE_MANAGER"])) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const total = await forBusiness(business.id).storeRequest.count({ where: { status: "NEW" } });
  return NextResponse.json({ total }, { headers: { "Cache-Control": "no-store" } });
}
