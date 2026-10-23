import Link from "next/link";
import { notFound } from "next/navigation";
import { effectiveMarkup, itemPrice } from "@/lib/store/settings";
import { ActionForm } from "@/components/admin/action-form";
import { FilePicker } from "@/components/file-picker";
import { loadAdminStore } from "@/lib/store/admin";
import { deleteItemAction, repriceItemAction, saveItemAction, saveItemPricesAction, uploadItemImageAction } from "../../../actions";

const money = (v: { toFixed(n: number): string }) => `$${v.toFixed(2)}`;

export default async function ItemPage({ params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  const { db, url } = await loadAdminStore(id);
  const item = await db.storeItem.findUnique({
    where: { id: itemId, storeId: id },
    include: {
      store: { include: { group: true } },
      prices: { include: { size: true }, orderBy: { size: { sortOrder: "asc" } } },
      design: { include: { product: true, color: true, decorations: { include: { method: true }, orderBy: { sortOrder: "asc" } } } },
    },
  });
  if (!item) notFound();
  const inherited = effectiveMarkup({ markupKind: null, markupValue: null }, item.store);
  const storeMarkup = inherited.markupKind ? `${inherited.markupKind === "PERCENT" ? `${inherited.markupValue}%` : money(inherited.markupValue!)}` : "none";
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/admin/stores/${id}/items`} className="text-sm text-amber-700 hover:underline">← Items</Link>
        {item.published && <a href={`${url}/shop/${item.slug}`} target="_blank" className="text-sm text-amber-700 hover:underline">View in the store ↗</a>}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="font-semibold">{item.name}</h2>
          <p className="text-sm text-gray-600">
            {item.design.product.styleCode} {item.design.product.name} · {item.design.color.name}
            <br />
            {item.design.decorations.map((d) => `${d.location}: ${d.method.name}${d.colors ? `, ${d.colors} color${d.colors === 1 ? "" : "s"}` : ""}`).join(" · ") || "Blank"}
          </p>
          <ActionForm action={saveItemAction} className="space-y-3">
            <input type="hidden" name="id" value={item.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="name">Name</label>
                <input className="input" id="name" name="name" defaultValue={item.name} required />
              </div>
              <div>
                <label className="label" htmlFor="slug">Address</label>
                <input className="input font-mono" id="slug" name="slug" defaultValue={item.slug} required />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="description">Description</label>
              <textarea className="input min-h-20" id="description" name="description" defaultValue={item.description ?? ""} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <span className="label">Markup (blank = store default: {storeMarkup})</span>
                <div className="flex gap-2">
                  <select className="input w-36" name="markupKind" defaultValue={item.markupKind ?? ""} aria-label="Markup type">
                    <option value="">Store default</option>
                    <option value="PERCENT">Percent (%)</option>
                    <option value="AMOUNT">Amount ($)</option>
                  </select>
                  <input className="input w-24" name="markupValue" defaultValue={item.markupValue?.toString() ?? ""} aria-label="Markup value" inputMode="decimal" />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="sortOrder">Order</label>
                <input className="input" id="sortOrder" name="sortOrder" defaultValue={item.sortOrder} inputMode="numeric" />
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked={item.published} /> On sale</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="featured" defaultChecked={item.featured} /> Featured on the home page</label>
            </div>
          </ActionForm>
        </section>

        <div className="space-y-6">
          <section className="card space-y-3" data-testid="item-prices">
            <h2 className="font-semibold">Prices</h2>
            <ActionForm action={saveItemPricesAction} submitLabel="Save prices" key={item.prices.map((p) => `${p.basePrice}/${p.overridePrice}`).join()}>
              <input type="hidden" name="id" value={item.id} />
              <table className="text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="pr-3">Size</th>
                    <th className="pr-3">Base</th>
                    <th className="pr-3">Override</th>
                    <th>Shopper pays</th>
                  </tr>
                </thead>
                <tbody>
                  {item.prices.map((p) => (
                    <tr key={p.id}>
                      <td className="pr-3 font-medium">{p.size.code}</td>
                      <td className="py-0.5 pr-3"><input className="input w-24" name={`base_${p.id}`} defaultValue={p.basePrice.toFixed(2)} aria-label={`Base ${p.size.code}`} inputMode="decimal" /></td>
                      <td className="py-0.5 pr-3"><input className="input w-24" name={`override_${p.id}`} defaultValue={p.overridePrice?.toFixed(2) ?? ""} aria-label={`Override ${p.size.code}`} inputMode="decimal" /></td>
                      <td className="font-semibold" data-testid={`final-${p.size.code}`}>{money(itemPrice(p, item, item.store))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ActionForm>
            <ActionForm action={repriceItemAction} submitLabel="Recalculate base prices" className="flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
              <input type="hidden" name="id" value={item.id} />
              <div>
                <label className="label" htmlFor="batchQty">From current pricing, as a batch of</label>
                <input className="input w-24" id="batchQty" name="batchQty" defaultValue="24" inputMode="numeric" />
              </div>
            </ActionForm>
          </section>

          <section className="card space-y-3">
            <h2 className="font-semibold">Picture</h2>
            {item.imageFileId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/admin/files/${item.imageFileId}`} alt={item.name} className="max-h-56 rounded border" />
            ) : (
              <p className="text-sm text-gray-500">No picture; the product photo (if any) or a color swatch is shown.</p>
            )}
            <ActionForm action={uploadItemImageAction} submitLabel="Upload" resetOnSuccess className="max-w-md space-y-2">
              <input type="hidden" name="id" value={item.id} />
              <label className="label" htmlFor="item-image">Item picture</label>
              <FilePicker id="item-image" name="image" accept="image/png,image/jpeg,image/gif,image/webp" required hint="PNG, JPG, GIF or WebP" />
            </ActionForm>
          </section>

          <ActionForm action={deleteItemAction} submitLabel="Delete item" danger confirm="Delete this item? Past orders keep their lines.">
            <input type="hidden" name="id" value={item.id} />
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
