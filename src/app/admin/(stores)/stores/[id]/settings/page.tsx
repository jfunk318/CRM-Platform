import { loadAdminStore } from "@/lib/store/admin";
import { ACCOUNT_MODE_LABELS, effectiveMarkup, effectiveSettings } from "@/lib/store/settings";
import { DELIVERY_KIND_LABELS } from "@/lib/shipping/labels";
import { ActionForm } from "@/components/admin/action-form";
import { deleteStoreAction, saveStoreAction } from "../../actions";

const yesNo = (v: boolean) => (v ? "yes" : "no");
const day = (d: Date | null, endOfDay = false) => (d ? new Date(d.getTime() - (endOfDay ? 86_399_000 : 0)).toISOString().slice(0, 10) : "");
const modeName = (m: keyof typeof ACCOUNT_MODE_LABELS) => ACCOUNT_MODE_LABELS[m].split(" (")[0].toLowerCase();

export default async function StoreSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, store, staff } = await loadAdminStore((await params).id);
  const business = staff.business;
  const affiliate = store.kind === "AFFILIATE";
  const [methods, groups, managers, customers] = await Promise.all([
    db.deliveryMethod.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.storeGroup.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    affiliate ? db.customer.findMany({ orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take: 500, include: { company: true } }) : [],
  ]);
  // What a blank setting falls back to: the group, else the business default.
  const inherited = effectiveSettings(business, { ...store, accountMode: null, showPrices: null, allowPayLater: null }, store.group);
  const from = store.group ? `group “${store.group.name}”` : "business default";
  const settings = effectiveSettings(business, store, store.group);
  const groupMarkup = effectiveMarkup({ markupKind: null, markupValue: null }, { markupKind: null, markupValue: null, group: store.group });
  const offered = new Set(store.deliveryMethods.map((d) => d.deliveryMethodId));

  return (
    <div className="space-y-6">
      <section className="card space-y-4" data-testid="store-settings">
        <ActionForm action={saveStoreAction} className="space-y-5">
          <input type="hidden" name="storeId" value={store.id} />
          <h2 className="font-semibold">Store</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Store name" name="name" value={store.name} required />
            {affiliate ? (
              <div>
                <label className="label" htmlFor="slug">Address</label>
                <div className="flex items-center gap-1">
                  <input className="input font-mono" id="slug" name="slug" defaultValue={store.slug ?? ""} required />
                  <span className="whitespace-nowrap font-mono text-sm text-gray-500">.{business.customDomain ?? `${business.slug}…`}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600 sm:pt-6">The main site lives at your own address ({business.customDomain ?? business.slug}).</p>
            )}
            <Field label="Tagline (shown in search results and the showcase)" name="tagline" value={store.tagline} />
            <div>
              <label className="label" htmlFor="managerId">Store manager</label>
              <select className="input" id="managerId" name="managerId" defaultValue={store.managerId ?? ""}>
                <option value="">Nobody</option>
                {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            {affiliate && (
              <>
                <div>
                  <label className="label" htmlFor="customerId">Store for (customer)</label>
                  <select className="input" id="customerId" name="customerId" defaultValue={store.customerId ?? ""}>
                    <option value="">Not set</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}{c.company ? ` · ${c.company.name}` : ""}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="groupId">Group</label>
                  <select className="input" id="groupId" name="groupId" defaultValue={store.groupId ?? ""}>
                    <option value="">No group</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <Field label="Opens (optional)" name="opensAt" type="date" value={day(store.opensAt)} />
                <Field label="Closes (optional)" name="closesAt" type="date" value={day(store.closesAt, true)} />
                <div className="space-y-1 text-sm sm:col-span-2">
                  <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={store.active} /> Store is on (untick to close it now)</label>
                  <label className="flex items-center gap-2"><input type="checkbox" name="showcase" defaultChecked={store.showcase} /> Show in store showcases</label>
                  <label className="flex items-start gap-2">
                    <input type="checkbox" name="batchOrders" defaultChecked={store.batchOrders} className="mt-1" />
                    <span>
                      Batch orders: hold them until the store closes, then make one production order for the store&apos;s customer
                      <span className="block text-xs text-gray-500">Same designs are combined, sizes added up and names kept on the roster. You can also batch from the store&apos;s Overview at any time.</span>
                    </span>
                  </label>
                </div>
              </>
            )}
          </div>

          <h3 className="text-sm font-semibold">Text around the store</h3>
          <p className="text-xs text-gray-500">Theme, colors, banner and logo are on the <a href={`/admin/stores/${store.id}/look`} className="text-amber-700 hover:underline">Look</a> tab.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Announcement bar (optional)" name="announcement" value={store.announcement} placeholder="e.g. Orders close Friday" />
            <div className="sm:col-span-2">
              <label className="label" htmlFor="footerText">Footer text</label>
              <textarea className="input min-h-14" id="footerText" name="footerText" defaultValue={store.footerText ?? ""} />
            </div>
          </div>

          <h3 className="text-sm font-semibold">Shopping</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="accountMode">Shopper accounts</label>
              <select className="input" id="accountMode" name="accountMode" defaultValue={store.accountMode ?? ""}>
                <option value="">Same as {from} ({modeName(inherited.accountMode)})</option>
                {Object.entries(ACCOUNT_MODE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <TriState label="Show prices" name="showPrices" value={store.showPrices} inherited={inherited.showPrices} from={from} />
            <TriState label="Allow “place order, pay later”" name="allowPayLater" value={store.allowPayLater} inherited={inherited.allowPayLater} from={from} />
            <Field label="Access code (blank = public)" name="accessCode" value={store.accessCode} />
            <div className="sm:col-span-2">
              <span className="label">Default markup on this store&apos;s items</span>
              <div className="flex gap-2">
                <select className="input w-44" name="markupKind" defaultValue={store.markupKind ?? ""} aria-label="Markup type">
                  <option value="">{groupMarkup.markupKind ? `Group's (${groupMarkup.markupKind === "PERCENT" ? `${groupMarkup.markupValue}%` : `$${groupMarkup.markupValue}`})` : "None"}</option>
                  <option value="PERCENT">Percent (%)</option>
                  <option value="AMOUNT">Amount ($)</option>
                </select>
                <input className="input w-28" name="markupValue" defaultValue={store.markupValue?.toString() ?? ""} aria-label="Markup value" inputMode="decimal" />
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Now: accounts {modeName(settings.accountMode)}, prices shown {yesNo(settings.showPrices)}, pay later {yesNo(settings.allowPayLater)}
            {settings.needsAccessCode ? ", access code required" : ""}.
          </p>

          <h3 className="text-sm font-semibold">Delivery methods offered</h3>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="customDeliveryMethods" defaultChecked={store.customDeliveryMethods} /> Offer only the ones ticked below (otherwise every active method)
          </label>
          <div className="flex flex-wrap gap-3 text-sm">
            {methods.map((m) => (
              <label key={m.id} className="flex items-center gap-1.5">
                <input type="checkbox" name="deliveryMethodIds" value={m.id} defaultChecked={!store.customDeliveryMethods || offered.has(m.id)} /> {m.name} <span className="text-gray-500">({DELIVERY_KIND_LABELS[m.kind]})</span>
              </label>
            ))}
          </div>

          <h3 className="text-sm font-semibold">Analytics (optional)</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Google Analytics 4 measurement ID" name="ga4Id" value={store.ga4Id} placeholder="G-XXXXXXX" />
            <Field label="Meta Pixel ID" name="metaPixelId" value={store.metaPixelId} />
          </div>
        </ActionForm>
      </section>

      {affiliate && (
        <ActionForm action={deleteStoreAction} submitLabel="Delete store" danger confirm={`Delete ${store.name}? This can't be undone.`} className="flex items-center gap-3">
          <input type="hidden" name="storeId" value={store.id} />
          <span className="text-xs text-gray-500">Only stores with no orders can be deleted; otherwise close the store.</span>
        </ActionForm>
      )}
    </div>
  );
}

function Field({ label, name, value, required, placeholder, type }: { label: string; name: string; value: string | null; required?: boolean; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input className="input" id={name} name={name} type={type} defaultValue={value ?? ""} required={required} placeholder={placeholder} />
    </div>
  );
}

function TriState({ label, name, value, inherited, from }: { label: string; name: string; value: boolean | null; inherited: boolean; from: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select className="input" id={name} name={name} defaultValue={value === null ? "" : value ? "on" : "off"}>
        <option value="">Same as {from} ({yesNo(inherited)})</option>
        <option value="on">Yes</option>
        <option value="off">No</option>
      </select>
    </div>
  );
}
