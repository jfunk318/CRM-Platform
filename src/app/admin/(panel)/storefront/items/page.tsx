import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { itemPrice } from "@/lib/store/settings";
import { ActionForm } from "@/components/admin/action-form";
import { LineEditor } from "@/components/admin/line-editor";
import { createItemAction } from "../actions";

const money = (v: { toFixed(n: number): string }) => `$${v.toFixed(2)}`;

export default async function ItemsPage() {
  const { db } = await requireStaff(["SALES"]);
  const store = await db.store.findFirstOrThrow({ where: { kind: "ROOT" } });
  const [items, products] = await Promise.all([
    db.storeItem.findMany({
      where: { storeId: store.id },
      include: { prices: { include: { size: true }, orderBy: { size: { sortOrder: "asc" } } }, design: { include: { product: true, color: true } }, _count: { select: { orderLines: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.product.findMany({ where: { status: { not: "DISCONTINUED" }, variants: { some: {} } }, orderBy: { name: "asc" }, select: { id: true, name: true, styleCode: true } }),
  ]);
  return (
    <div className="space-y-6">
      <div className="card overflow-x-auto p-0">
        <table className="table" data-testid="items">
          <thead>
            <tr>
              <th>Item</th>
              <th>Garment</th>
              <th>Sizes</th>
              <th>Price</th>
              <th>Sold on</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="text-gray-500">Nothing for sale yet. Add your first item below.</td>
              </tr>
            )}
            {items.map((i) => {
              const prices = i.prices.map((p) => itemPrice(p, i, store));
              const lo = prices.length ? prices.reduce((a, b) => (b.lt(a) ? b : a)) : null;
              const hi = prices.length ? prices.reduce((a, b) => (b.gt(a) ? b : a)) : null;
              return (
                <tr key={i.id}>
                  <td>
                    <Link href={`/admin/storefront/items/${i.id}`} className="font-medium text-amber-700 hover:underline">{i.name}</Link>
                    {i.featured && <span className="ml-1 rounded bg-amber-100 px-1 text-xs">Featured</span>}
                  </td>
                  <td className="text-sm">{i.design.product.styleCode} · {i.design.color.name}</td>
                  <td className="text-sm">{i.prices.map((p) => p.size.code).join(", ")}</td>
                  <td>{lo && hi ? (lo.equals(hi) ? money(lo) : `${money(lo)}–${money(hi)}`) : "—"}</td>
                  <td>{i._count.orderLines} order{i._count.orderLines === 1 ? "" : "s"}</td>
                  <td>{i.published ? "On sale" : <span className="text-gray-500">Hidden</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <details className="card" open={items.length === 0}>
        <summary className="cursor-pointer font-medium text-amber-700">+ Add an item</summary>
        <ActionForm action={createItemAction} submitLabel="Create item" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="item-name">Name shoppers see</label>
              <input className="input" id="item-name" name="name" required placeholder="Classic Logo Tee" />
            </div>
            <div>
              <label className="label" htmlFor="batchQty">Price as a batch of</label>
              <input className="input" id="batchQty" name="batchQty" defaultValue="24" inputMode="numeric" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="item-desc">Description (optional)</label>
            <textarea className="input min-h-16" id="item-desc" name="description" />
          </div>
          <LineEditor products={products} sizeMode="select" />
          <p className="text-xs text-gray-500">
            Base prices per size come from your pricing (garment, decoration at the batch quantity, and setup fees spread over the batch). You can
            change them, override them or add a markup on the next screen.
          </p>
        </ActionForm>
      </details>
    </div>
  );
}
