import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { loadAdminStore } from "@/lib/store/admin";
import { designerConfig, designerGarments } from "@/lib/store/designer";
import { saveDesignerAction } from "../../actions";

/** The store's online designer: whether shoppers can design their own, and what they may do. */
export default async function DesignerSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, store, url } = await loadAdminStore((await params).id);
  const methods = await db.decorationMethod.findMany({ where: { active: true, shopperDesign: true }, orderBy: { sortOrder: "asc" } });
  const config = await designerConfig(db, store);
  const garments = config.enabled ? await designerGarments(db, store, config) : [];
  const main = store.kind === "ROOT";
  return (
    <div className="space-y-6">
      <section className="card space-y-4">
        <div>
          <h2 className="font-semibold">Online designer</h2>
          <p className="max-w-3xl text-sm text-gray-600">
            Shoppers pick a garment and color, add artwork, see the price and add it to the cart. Orders with a shopper&apos;s design don&apos;t go
            straight to production: check the artwork (send a proof if anything needs their OK), then create the production jobs on the order.
          </p>
        </div>
        {methods.length === 0 ? (
          <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
            No decoration method is open to shoppers yet. Under <Link href="/admin/methods" className="underline">Decoration methods</Link>, tick
            &ldquo;Shoppers can choose it in the online designer&rdquo; on the methods you&apos;ll take online.
          </p>
        ) : (
          <ActionForm action={saveDesignerAction}>
            <input type="hidden" name="storeId" value={store.id} />
            <label className="flex items-center gap-2 font-medium">
              <input type="checkbox" name="enabled" defaultChecked={store.designerEnabled} /> Let shoppers design their own
            </label>
            <fieldset className="space-y-1 text-sm">
              <legend className="label">Shoppers can</legend>
              <label className="flex items-center gap-2"><input type="checkbox" name="upload" defaultChecked={store.designerUpload} /> Upload their own images</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="text" defaultChecked={store.designerText} /> Add text</label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="library" defaultChecked={store.designerLibrary} disabled={!store.customerId} />
                Use the {main ? "store's" : "team's"} own artwork (the store customer&apos;s artwork library){!store.customerId && <span className="text-gray-500"> (choose the store&apos;s customer in Settings first)</span>}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="anyGarment" defaultChecked={store.designerAnyGarment} /> Choose any garment from the catalog (otherwise only garments this store sells)
              </label>
            </fieldset>
            <fieldset className="space-y-1 text-sm">
              <legend className="label">Decoration methods offered</legend>
              {methods.map((m) => (
                <label key={m.id} className="flex items-center gap-2">
                  <input type="checkbox" name="methodIds" value={m.id} defaultChecked={store.designerMethodIds.length === 0 || store.designerMethodIds.includes(m.id)} /> {m.name}
                  <span className="text-xs text-gray-500">(minimum {m.minQty})</span>
                </label>
              ))}
              <p className="text-xs text-gray-500">Prices are the business&apos;s prices for the quantity bought, with setup spread over the pieces, plus this store&apos;s markup.</p>
            </fieldset>
          </ActionForm>
        )}
      </section>
      {config.enabled && (
        <section className="card space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Garments shoppers can choose ({garments.length})</h2>
            <a href={`${url}/design`} target="_blank" className="text-sm text-amber-700 hover:underline">Open the designer ↗</a>
          </div>
          {garments.length === 0 ? (
            <p className="text-sm text-gray-600">None yet: garments need a print area and a photo (Products → Views &amp; decoration areas) and a method above{config.anyGarment ? "" : ", and this store has to sell them"}.</p>
          ) : (
            <p className="text-sm text-gray-600">{garments.slice(0, 12).map((g) => g.name).join(", ")}{garments.length > 12 ? `, and ${garments.length - 12} more` : ""}</p>
          )}
        </section>
      )}
    </div>
  );
}
