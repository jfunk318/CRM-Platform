import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { orderRef, poRef } from "@/lib/orders/numbers";
import { variantLabel } from "@/lib/purchasing/service";
import { ActionButton } from "@/components/admin/action-button";
import { ActionForm } from "@/components/admin/action-form";
import { setStockAction, stopTrackingAction, trackStockAction } from "../purchasing/actions";

const REASONS = { RECEIVED: "Received", ADJUSTED: "Counted", USED: "Used for", RETURNED: "Returned from" } as const;
const when = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ low?: string }> }) {
  const { db } = await requireStaff(["PURCHASING"]);
  const { low } = await searchParams;
  const [variants, movements] = await Promise.all([
    db.productVariant.findMany({
      where: { stockOnHand: { not: null } },
      include: { product: { include: { supplier: true } }, color: true, size: true },
      orderBy: [{ product: { name: "asc" } }, { color: { name: "asc" } }, { size: { sortOrder: "asc" } }],
    }),
    db.stockMovement.findMany({
      take: 30,
      orderBy: { createdAt: "desc" },
      include: { variant: true, order: true, purchaseOrder: true, staff: { select: { name: true } } },
    }),
  ]);
  const isLow = (v: (typeof variants)[number]) => v.reorderPoint !== null && (v.stockOnHand ?? 0) <= v.reorderPoint;
  const lowCount = variants.filter(isLow).length;
  const shown = low ? variants.filter(isLow) : variants;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Inventory</h1>
        <p className="text-sm text-gray-500">
          Blanks kept in-house. Purchasing uses stock before ordering, and anything received beyond what orders need lands here.
        </p>
      </div>
      <nav className="flex gap-2 text-sm">
        <Link href="/admin/inventory" className={`rounded-full border px-3 py-1 ${!low ? "border-brand-500 bg-brand-50" : "border-gray-200 bg-white"}`}>All ({variants.length})</Link>
        <Link href="/admin/inventory?low=1" className={`rounded-full border px-3 py-1 ${low ? "border-brand-500 bg-brand-50" : "border-gray-200 bg-white"}`}>Low stock ({lowCount})</Link>
      </nav>

      <section className="card overflow-x-auto p-0">
        <table className="table" data-testid="stock">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Item</th>
              <th>Supplier</th>
              <th>On hand · reorder at · note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="text-gray-500">{low ? "Nothing is low." : "Not tracking any stock yet. Add a SKU below."}</td>
              </tr>
            )}
            {shown.map((v) => (
              <tr key={v.id} className={isLow(v) ? "bg-brand-50" : ""}>
                <td className="font-mono text-xs">{v.sku}</td>
                <td>
                  {variantLabel(v)}
                  {isLow(v) && <span className="ml-2 rounded bg-brand-200 px-1 text-xs">Low</span>}
                </td>
                <td>{v.product.supplier?.name ?? "—"}</td>
                <td>
                  <ActionForm action={setStockAction} submitLabel="Save" className="flex flex-wrap items-center gap-1">
                    <input type="hidden" name="variantId" value={v.id} />
                    <input className="input w-20" name="onHand" defaultValue={v.stockOnHand ?? 0} aria-label={`On hand ${v.sku}`} inputMode="numeric" />
                    <input className="input w-20" name="reorderPoint" defaultValue={v.reorderPoint ?? ""} placeholder="—" aria-label={`Reorder at ${v.sku}`} inputMode="numeric" />
                    <input className="input w-36" name="note" placeholder="why (optional)" aria-label="Note" />
                  </ActionForm>
                </td>
                <td>
                  {(v.stockOnHand ?? 0) === 0 && <ActionButton action={stopTrackingAction} fields={{ variantId: v.id }} label="Stop tracking" className="text-xs text-red-700 hover:underline" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <ActionForm action={trackStockAction} submitLabel="Track this SKU" resetOnSuccess className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="track-sku">Start tracking: SKU or supplier SKU</label>
          <input className="input font-mono" id="track-sku" name="sku" required />
        </div>
      </ActionForm>

      <section className="card text-sm">
        <h2 className="mb-2 font-semibold">Recent changes</h2>
        {movements.length === 0 && <p className="text-gray-500">None yet.</p>}
        <ul className="divide-y divide-gray-100">
          {movements.map((m) => (
            <li key={m.id} className="flex flex-wrap justify-between gap-2 py-1.5">
              <span>
                <span className={m.change > 0 ? "text-green-700" : "text-red-700"}>{m.change > 0 ? `+${m.change}` : m.change}</span>{" "}
                <span className="font-mono text-xs">{m.variant.sku}</span> · {REASONS[m.reason]}
                {m.order && <> <Link href={`/admin/orders/${m.order.id}`} className="text-brand-700 hover:underline">{orderRef(m.order)}</Link></>}
                {m.purchaseOrder && <> on <Link href={`/admin/purchasing/${m.purchaseOrder.id}`} className="text-brand-700 hover:underline">{poRef(m.purchaseOrder.number)}</Link></>}
                {m.note && <span className="text-gray-500"> · {m.note}</span>}
              </span>
              <span className="text-xs text-gray-500">{m.staff?.name ?? "System"} · {when(m.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
