import Link from "next/link";
import { poRef } from "@/lib/orders/numbers";
import { ActionForm } from "@/components/admin/action-form";
import { saveSupplierInfo } from "../../actions";
import { loadProduct } from "../load";
import { Field, SectionFrame, Select } from "../section";

const PO_STATUS = { DRAFT: "Draft", SENT: "Sent", PARTIAL: "Part received", RECEIVED: "Received", CANCELLED: "Cancelled" } as const;

export default async function ProductSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, product } = await loadProduct((await params).id);
  const [suppliers, poLines] = await Promise.all([
    db.supplier.findMany({ orderBy: { name: "asc" } }),
    db.purchaseOrderLine.findMany({
      where: { variant: { productId: product.id } },
      include: { purchaseOrder: true },
      orderBy: { purchaseOrder: { number: "desc" } },
      take: 200,
    }),
  ]);
  // One row per purchase order, newest first.
  const pos = [...poLines.reduce((m, l) => {
    const e = m.get(l.purchaseOrderId) ?? { po: l.purchaseOrder, qty: 0, received: 0 };
    e.qty += l.qty;
    e.received += l.qtyReceived;
    return m.set(l.purchaseOrderId, e);
  }, new Map<string, { po: (typeof poLines)[number]["purchaseOrder"]; qty: number; received: number }>()).values()].slice(0, 10);

  return (
    <SectionFrame
      title="Supplier & Purchasing"
      intro={<p>Who you buy this product from. Blanks for orders are bought on purchase orders to this supplier, using each SKU&apos;s supplier order code (under SKUs &amp; Inventory).</p>}
      aside={
        product.externalSource && (
          <p className="text-gray-600">
            Linked to {product.supplier?.name ?? product.externalSource} style <span className="font-mono">{product.externalId}</span>; catalog imports keep its costs and photos up to date.
          </p>
        )
      }
    >
      <ActionForm action={saveSupplierInfo} className="max-w-xl space-y-4">
        <input type="hidden" name="id" value={product.id} />
        <Select label="Supplier" name="supplierId" value={product.supplierId ?? ""}>
          <option value="">In-house / custom</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Field label="Spec sheet link" name="specSheetUrl" value={product.specSheetUrl ?? ""} placeholder="https://…" />
        {product.specSheetUrl && <a href={product.specSheetUrl} target="_blank" className="text-sm text-amber-700 hover:underline">Open the spec sheet ↗</a>}
      </ActionForm>

      <div className="border-t border-gray-200 pt-5">
        <h3 className="mb-2 font-medium">Recent purchase orders</h3>
        {pos.length === 0 ? (
          <p className="text-sm text-gray-500">Not on any purchase orders yet.</p>
        ) : (
          <table className="table max-w-xl">
            <thead>
              <tr><th>PO</th><th>Status</th><th className="text-right">Pieces</th><th className="text-right">Received</th></tr>
            </thead>
            <tbody>
              {pos.map(({ po, qty, received }) => (
                <tr key={po.id}>
                  <td><Link href={`/admin/purchasing/${po.id}`} className="text-amber-700 hover:underline">{poRef(po.number)}</Link></td>
                  <td>{PO_STATUS[po.status]}</td>
                  <td className="text-right">{qty}</td>
                  <td className="text-right">{received}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </SectionFrame>
  );
}
