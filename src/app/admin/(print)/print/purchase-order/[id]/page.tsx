import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { poRef } from "@/lib/orders/numbers";
import { purchaseOrderInclude, shipToLines, variantLabel } from "@/lib/purchasing/service";

export const metadata = { title: "Purchase order" };

const money = (v: { toFixed(n: number): string }) => `$${v.toFixed(2)}`;
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function PrintPurchaseOrder({ params }: { params: Promise<{ id: string }> }) {
  const { db, business } = await requireStaff(["PURCHASING"]);
  const { id } = await params;
  const po = await db.purchaseOrder.findUnique({ where: { id }, include: purchaseOrderInclude });
  if (!po) notFound();
  const from = [business.name, business.addressLine1, business.addressLine2, [business.city, [business.region, business.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", "), business.phone, business.email].filter(Boolean);
  return (
    <article className="space-y-5 text-sm">
      <header className="flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          {from.map((l, i) => <div key={i} className={i === 0 ? "text-lg font-bold" : ""}>{l}</div>)}
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-bold">Purchase order</h1>
          <div className="text-lg">{poRef(po.number)}</div>
          <div>Date: {day(po.sentAt ?? po.createdAt)}</div>
          {po.expectedAt && <div>Needed by: {day(po.expectedAt)}</div>}
          {po.status === "CANCELLED" && <div className="font-bold">CANCELLED</div>}
        </div>
      </header>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="text-xs uppercase text-gray-600">Supplier</div>
          <div className="font-semibold">{po.supplier.name}</div>
          {po.supplier.accountNumber && <div>Account {po.supplier.accountNumber}</div>}
          {po.supplier.email && <div>{po.supplier.email}</div>}
          {po.supplier.phone && <div>{po.supplier.phone}</div>}
        </div>
        <div>
          <div className="text-xs uppercase text-gray-600">Ship to</div>
          {shipToLines(po).map((l, i) => <div key={i}>{l}</div>)}
          {po.blindShip && <div className="mt-1 font-bold">SHIP BLIND — no packing list, invoice or supplier branding</div>}
        </div>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-1">SKU</th>
            <th>Item</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Cost</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {po.lines.map((l) => (
            <tr key={l.id} className="border-b border-gray-300">
              <td className="py-1 font-mono text-xs">{l.variant.supplierSku ?? l.variant.sku}</td>
              <td>{variantLabel(l.variant)}</td>
              <td className="text-right">{l.qty}</td>
              <td className="text-right">{money(l.unitCost)}</td>
              <td className="text-right">{money(l.unitCost.times(l.qty))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td colSpan={2} className="py-1">Total</td>
            <td className="text-right">{po.lines.reduce((n, l) => n + l.qty, 0)}</td>
            <td></td>
            <td className="text-right">{money(po.total)}</td>
          </tr>
        </tfoot>
      </table>
      {po.notes && <p className="whitespace-pre-wrap">{po.notes}</p>}
    </article>
  );
}
