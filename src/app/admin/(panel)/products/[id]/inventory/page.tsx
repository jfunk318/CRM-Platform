import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { saveInventory } from "../../actions";
import { loadProduct } from "../load";
import { SectionFrame } from "../section";

// Above this many SKUs, show one color at a time.
const MAX_ROWS = 150;

export default async function ProductInventoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ color?: string }> }) {
  const { db, product } = await loadProduct((await params).id);
  const sp = await searchParams;
  const colors = await db.productColor.findMany({ where: { productId: product.id }, orderBy: { sortOrder: "asc" } });
  const paged = product._count.variants > MAX_ROWS;
  const colorId = sp.color === "all" && !paged ? undefined : (colors.find((c) => c.id === sp.color)?.id ?? (paged ? colors[0]?.id : undefined));
  const variants = await db.productVariant.findMany({
    where: { productId: product.id, ...(colorId ? { colorId } : {}) },
    include: { color: true, size: true },
    orderBy: [{ color: { sortOrder: "asc" } }, { size: { sortOrder: "asc" } }],
  });
  const stocked = await db.productVariant.aggregate({ where: { productId: product.id, stockOnHand: { not: null } }, _sum: { stockOnHand: true }, _count: true });

  return (
    <SectionFrame
      title="SKUs & Inventory"
      intro={
        <>
          <p>Each color and size you sell is a SKU. Your SKU code is built from the product code, color and size.</p>
          <p>The supplier code is what goes on purchase orders. Stock is what you keep in-house (blank = not stocked); you&apos;re alerted at or below the reorder level.</p>
          <p>Add or remove SKUs by setting costs under <Link href={`/admin/products/${product.id}/pricing`} className="text-brand-700 hover:underline">Pricing</Link>.</p>
        </>
      }
      aside={
        <>
          <div className="flex justify-between"><span className="text-gray-600">SKUs</span><span className="font-medium">{product._count.variants}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Stocked in-house</span><span className="font-medium">{stocked._count} SKUs · {(stocked._sum.stockOnHand ?? 0).toLocaleString()} pcs</span></div>
        </>
      }
    >
      {colors.length > 1 && (
        <form className="flex items-end gap-2">
          <div>
            <label className="label" htmlFor="sku-color">Color</label>
            <select className="input w-56" id="sku-color" name="color" defaultValue={colorId ?? "all"}>
              {!paged && <option value="all">All colors</option>}
              {colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button className="btn-secondary">Show</button>
        </form>
      )}
      {variants.length === 0 ? (
        <p className="text-sm text-gray-500">No SKUs yet. Set costs under Pricing to add them.</p>
      ) : (
        <ActionForm action={saveInventory} submitLabel="Save SKUs">
          <input type="hidden" name="productId" value={product.id} />
          <div className="overflow-x-auto">
            <table className="table" data-testid="sku-table">
              <thead>
                <tr>
                  <th>Color / size</th>
                  <th>SKU</th>
                  <th>Supplier code</th>
                  <th>In stock</th>
                  <th>Reorder at</th>
                  <th>Supplier stock</th>
                  <th>Selling</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id}>
                    <td className="whitespace-nowrap">
                      <input type="hidden" name="variantId" value={v.id} />
                      <span className="mr-1.5 inline-block h-3 w-3 rounded-full border align-middle" style={{ background: v.color.hex ?? "#fff" }} />
                      {v.color.name} · {v.size.code}
                    </td>
                    <td className="font-mono text-xs whitespace-nowrap">{v.sku}</td>
                    <td><input className="input w-44 font-mono text-xs" name={`ssku_${v.id}`} defaultValue={v.supplierSku ?? ""} aria-label={`${v.color.name} ${v.size.code} supplier code`} /></td>
                    <td><input className="input w-20" name={`stock_${v.id}`} defaultValue={v.stockOnHand?.toString() ?? ""} placeholder="—" aria-label={`${v.color.name} ${v.size.code} stock`} /></td>
                    <td><input className="input w-20" name={`reorder_${v.id}`} defaultValue={v.reorderPoint?.toString() ?? ""} placeholder="—" aria-label={`${v.color.name} ${v.size.code} reorder level`} /></td>
                    <td className="text-gray-600">{v.supplierStock?.toLocaleString() ?? "—"}</td>
                    <td><input type="checkbox" name={`active_${v.id}`} defaultChecked={v.active} aria-label={`Sell ${v.color.name} ${v.size.code}`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ActionForm>
      )}
    </SectionFrame>
  );
}
