import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { orderRef } from "@/lib/orders/numbers";

export const orderTableInclude = {
  customer: { select: { firstName: true, lastName: true } },
  company: { select: { name: true } },
  status: true,
  assignedTo: { select: { name: true } },
  _count: { select: { lines: true } },
} satisfies Prisma.OrderInclude;

type Row = Prisma.OrderGetPayload<{ include: typeof orderTableInclude }>;

export function StatusBadge({ status }: { status: { name: string; color: string } }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2 py-0.5 text-xs whitespace-nowrap">
      <span className="h-2 w-2 rounded-full" style={{ background: status.color }} />
      {status.name}
    </span>
  );
}

/** "Online" for storefront orders, "Web request" for quote requests. */
export function SourceTag({ source }: { source: "STAFF" | "STOREFRONT" | "QUOTE_REQUEST" }) {
  if (source === "STAFF") return null;
  return (
    <span className="ml-1.5 rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-800">{source === "STOREFRONT" ? "Online" : "Web request"}</span>
  );
}

const date = (d: Date | null) => (d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "");

export function OrderTable({ orders, empty = "Nothing here yet." }: { orders: Row[]; empty?: string }) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Assigned</th>
            <th>Due</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-gray-500">{empty}</td>
            </tr>
          )}
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                <Link href={`/admin/orders/${o.id}`} className="font-medium text-amber-700 hover:underline">
                  {orderRef(o)}
                </Link>
                <SourceTag source={o.source} />
                {o.title && <div className="text-xs text-gray-500">{o.title}</div>}
              </td>
              <td>
                {o.customer.firstName} {o.customer.lastName}
                {o.company && <div className="text-xs text-gray-500">{o.company.name}</div>}
              </td>
              <td><StatusBadge status={o.status} /></td>
              <td>{o.assignedTo?.name ?? <span className="text-gray-400">—</span>}</td>
              <td className={o.dueDate && o.dueDate < new Date() && !o.status.isClosed ? "font-medium text-red-600" : ""}>
                {date(o.dueDate)}{o.rush && <span className="ml-1 rounded bg-red-100 px-1 text-xs text-red-700">Rush</span>}
              </td>
              <td className="text-right">${o.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
