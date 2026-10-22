import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { today } from "@/lib/production/defaults";
import { OrderTable, orderTableInclude } from "@/components/admin/order-table";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const staff = await requireStaff();
  const { db } = staff;
  const { denied } = await searchParams;
  const now = today();
  const [products, methods, placeholderTables, mine, jobsToday, jobsLate, openPos, readyToShip, stocked] = await Promise.all([
    db.product.count(),
    db.decorationMethod.count({ where: { active: true } }),
    db.decorationPriceTable.count({ where: { isPlaceholder: true } }),
    db.order.findMany({
      where: { assignedToId: staff.id, status: { isClosed: false } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      take: 20,
      include: orderTableInclude,
    }),
    db.productionJob.count({ where: { scheduledFor: now, status: { not: "DONE" } } }),
    db.productionJob.count({ where: { status: { not: "DONE" }, order: { dueDate: { lt: now }, status: { isClosed: false } } } }),
    db.purchaseOrder.count({ where: { status: { in: ["SENT", "PARTIAL"] } } }),
    db.order.count({ where: { type: "ORDER", status: { role: "ORDER_READY" } } }),
    db.productVariant.findMany({ where: { reorderPoint: { not: null }, stockOnHand: { not: null } }, select: { stockOnHand: true, reorderPoint: true } }),
  ]);
  const lowStock = stocked.filter((v) => v.stockOnHand! <= v.reorderPoint!).length;

  return (
    <div className="space-y-6">
      <h1 className="page-title">Welcome, {staff.name}</h1>
      {denied && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          You don&apos;t have access to that page. Ask an admin to add the role you need.
        </p>
      )}
      {placeholderTables > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {placeholderTables} decoration price table{placeholderTables === 1 ? " still has" : "s still have"}{" "}
          placeholder prices.{" "}
          <Link href="/admin/methods" className="font-medium underline">
            Enter real prices
          </Link>{" "}
          before taking orders.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" data-testid="floor-stats">
        {hasAnyRole(staff.roles, ["PRODUCTION"]) && <Stat label="Jobs on today's schedule" value={jobsToday} href="/admin/production/calendar" />}
        {hasAnyRole(staff.roles, ["PRODUCTION"]) && <Stat label="Jobs past the due date" value={jobsLate} href="/admin/production" warn={jobsLate > 0} />}
        {hasAnyRole(staff.roles, ["PURCHASING"]) && <Stat label="Purchase orders on the way" value={openPos} href="/admin/purchasing" />}
        {hasAnyRole(staff.roles, ["PURCHASING"]) && <Stat label="Low-stock items" value={lowStock} href="/admin/inventory?low=1" warn={lowStock > 0} />}
        {hasAnyRole(staff.roles, ["SHIPPING"]) && <Stat label="Ready to go out" value={readyToShip} href="/admin/shipping" />}
      </div>
      <section className="space-y-2">
        <h2 className="font-semibold">Assigned to me</h2>
        <OrderTable orders={mine} empty="Nothing open is assigned to you." />
      </section>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Products" value={products} href="/admin/products" />
        <Stat label="Active decoration methods" value={methods} href="/admin/methods" />
        <Stat label="Placeholder price tables" value={placeholderTables} href="/admin/methods" />
      </div>
    </div>
  );
}

function Stat({ label, value, href, warn }: { label: string; value: number; href: string; warn?: boolean }) {
  return (
    <Link href={href} className="card block hover:border-amber-300">
      <div className={`text-2xl font-semibold ${warn ? "text-red-600" : ""}`}>{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </Link>
  );
}
