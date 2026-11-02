import { NextResponse, type NextRequest } from "next/server";
import { forBusiness } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth/session";
import { getRequestBusiness } from "@/lib/business";
import { hasAnyRole } from "@/lib/auth/roles";

export type CustomerHit = { id: string; name: string; company: string | null; email: string | null };

/** Customers matching a name, email, phone or company, for the dashboard's Create a quote. */
export async function GET(req: NextRequest) {
  const [staff, business] = [await getCurrentStaff(), await getRequestBusiness()];
  if (!staff || !business || !hasAnyRole(staff.roles, ["SALES"])) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const db = forBusiness(business.id);
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  const words = q.split(/\s+/).filter(Boolean);
  const customers = await db.customer.findMany({
    where: {
      AND: words.map((w) => ({
        OR: [
          { firstName: { contains: w, mode: "insensitive" as const } },
          { lastName: { contains: w, mode: "insensitive" as const } },
          { email: { contains: w, mode: "insensitive" as const } },
          { phone: { contains: w } },
          { company: { name: { contains: w, mode: "insensitive" as const } } },
        ],
      })),
    },
    orderBy: q ? [{ lastName: "asc" }, { firstName: "asc" }] : { updatedAt: "desc" },
    take: 8,
    select: { id: true, firstName: true, lastName: true, email: true, company: { select: { name: true } } },
  });
  const hits: CustomerHit[] = customers.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`.trim(), company: c.company?.name ?? null, email: c.email }));
  return NextResponse.json(hits);
}
