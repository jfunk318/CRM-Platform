import Link from "next/link";
import type { PurchaseOrderStatus } from "@prisma/client";
import { requireStaff } from "@/lib/auth/session";
import { orderRef, poRef } from "@/lib/orders/numbers";
import { PO_STATUS } from "@/lib/purchasing/labels";
import { blankNeeds } from "@/lib/purchasing/service";
import { ActionForm } from "@/components/admin/action-form";
import { createPoAction, orderBlanksAction } from "./actions";

const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const money = (v: { toFixed(n: number): string }) => `$${v.toFixed(2)}`;

export default async function PurchasingPage() {
  const { db } = await requireStaff(["PURCHASING"]);
  const [needs, openPos, recentPos, suppliers] = await Promise.all([
    blankNeeds(db),
    db.purchaseOrder.findMany({
      where: { status: { in: ["DRAFT", "SENT", "PARTIAL"] } },
      include: { supplier: true, _count: { select: { lines: true } }, lines: { select: { qty: true, qtyReceived: true } } },
      orderBy: { number: "desc" },
    }),
    db.purchaseOrder.findMany({
      where: { status: { in: ["RECEIVED", "CANCELLED"] } },
      include: { supplier: true, _count: { select: { lines: true } }, lines: { select: { qty: true, qtyReceived: true } } },
      orderBy: { updatedAt: "desc" },
      take: 15,
    }),
    db.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  // Shortfalls, grouped by supplier.
  const rows = needs.flatMap(({ order, rows }) => rows.filter((r) => r.short > 0).map((r) => ({ order, r })));
  const orderable = rows.filter(({ r }) => r.variant?.product.supplier);
  const blocked = rows.filter(({ r }) => !r.variant?.product.supplier);
  const bySupplier = new Map<string, { name: string; items: typeof orderable }>();
  for (const x of orderable) {
    const s = x.r.variant!.product.supplier!;
    const g = bySupplier.get(s.id) ?? { name: s.name, items: [] };
    g.items.push(x);
    bySupplier.set(s.id, g);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Purchasing</h1>
        <p className="text-sm text-gray-500">
          Blanks open orders still need, and purchase orders to suppliers. Ordering adds to each supplier&apos;s draft PO, so
          several orders go out on one PO.
        </p>
      </div>

      <section className="space-y-3" data-testid="needs">
        <h2 className="font-semibold">Blanks to order</h2>
        {rows.length === 0 && <p className="text-sm text-gray-500">Every open order&apos;s blanks are covered.</p>}
        {bySupplier.size > 0 && (
          <ActionForm action={orderBlanksAction} submitLabel="Add to draft purchase orders" className="space-y-4">
            {[...bySupplier].map(([id, g]) => (
              <div key={id} className="card overflow-x-auto p-0">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
                  <h3 className="font-medium">{g.name}</h3>
                  <span className="text-sm text-gray-500">{g.items.reduce((n, x) => n + x.r.short, 0)} pieces</span>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th className="w-8"></th>
                      <th>Order</th>
                      <th>Item</th>
                      <th className="text-right">Short</th>
                      <th className="text-right">In stock</th>
                      <th>Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map(({ order, r }) => (
                      <tr key={r.key}>
                        <td>
                          <input type="checkbox" name="key" value={r.key} defaultChecked aria-label={`Order ${r.label} for ${orderRef(order)}`} />
                        </td>
                        <td>
                          <Link href={`/admin/orders/${order.id}`} className="text-brand-700 hover:underline">{orderRef(order)}</Link>
                          <div className="text-xs text-gray-500">{order.customer.firstName} {order.customer.lastName}</div>
                        </td>
                        <td>
                          {r.label}
                          <div className="font-mono text-xs text-gray-500">{r.variant!.supplierSku ?? r.variant!.sku}</div>
                        </td>
                        <td className="text-right font-medium">{r.short}</td>
                        <td className="text-right">{r.variant!.stockOnHand ?? "—"}</td>
                        <td>
                          {order.dueDate ? day(order.dueDate) : "—"}
                          {order.rush && <span className="ml-1 rounded bg-red-100 px-1 text-xs text-red-700">Rush</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="useStock" defaultChecked /> Use in-house stock first
            </label>
          </ActionForm>
        )}
        {blocked.length > 0 && (
          <div className="rounded-md border border-warn-300 bg-warn-50 px-3 py-2 text-sm text-warn-900">
            <div className="font-medium">Can&apos;t be ordered yet</div>
            <ul className="list-disc pl-5">
              {blocked.map(({ order, r }) => (
                <li key={r.key}>
                  <Link href={`/admin/orders/${order.id}`} className="underline">{orderRef(order)}</Link>: {r.short} × {r.label} —{" "}
                  {r.variant ? (
                    <>no supplier on <Link href={`/admin/products/${r.variant.productId}`} className="underline">the product</Link></>
                  ) : (
                    "no SKU in the catalog for this color and size"
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-semibold">Purchase orders</h2>
          <ActionForm action={createPoAction} submitLabel="New purchase order" className="flex items-end gap-2">
            <div>
              <label className="label" htmlFor="supplierId">Supplier</label>
              <select className="input" id="supplierId" name="supplierId" required>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </ActionForm>
        </div>
        <PoTable pos={openPos} empty="No open purchase orders." />
        {recentPos.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm text-brand-700">Recently received or cancelled</summary>
            <div className="mt-2">
              <PoTable pos={recentPos} empty="" />
            </div>
          </details>
        )}
      </section>
    </div>
  );
}

type PoRow = {
  id: string;
  number: number;
  status: PurchaseOrderStatus;
  supplier: { name: string };
  total: { toFixed(n: number): string };
  sentAt: Date | null;
  expectedAt: Date | null;
  lines: { qty: number; qtyReceived: number }[];
};

function PoTable({ pos, empty }: { pos: PoRow[]; empty: string }) {
  if (pos.length === 0) return <p className="text-sm text-gray-500">{empty}</p>;
  return (
    <div className="card overflow-x-auto p-0">
      <table className="table" data-testid="po-table">
        <thead>
          <tr>
            <th>PO</th>
            <th>Supplier</th>
            <th>Status</th>
            <th className="text-right">Pieces</th>
            <th className="text-right">Received</th>
            <th className="text-right">Total</th>
            <th>Sent</th>
            <th>Expected</th>
          </tr>
        </thead>
        <tbody>
          {pos.map((po) => (
            <tr key={po.id}>
              <td>
                <Link href={`/admin/purchasing/${po.id}`} className="font-medium text-brand-700 hover:underline">{poRef(po.number)}</Link>
              </td>
              <td>{po.supplier.name}</td>
              <td>
                <span className={`rounded-full px-2 py-0.5 text-xs ${PO_STATUS[po.status].className}`}>{PO_STATUS[po.status].label}</span>
              </td>
              <td className="text-right">{po.lines.reduce((n, l) => n + l.qty, 0)}</td>
              <td className="text-right">{po.lines.reduce((n, l) => n + l.qtyReceived, 0)}</td>
              <td className="text-right">{money(po.total)}</td>
              <td>{po.sentAt ? po.sentAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }) : "—"}</td>
              <td>{po.expectedAt ? day(po.expectedAt) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
