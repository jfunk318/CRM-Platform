import { requireStaff } from "@/lib/auth/session";
import { requestOrigin } from "@/lib/business";
import { decryptSecret, maskSecret } from "@/lib/crypto";
import { ACCOUNT_MODE_LABELS, effectiveSettings } from "@/lib/store/settings";
import { DELIVERY_KIND_LABELS } from "@/lib/shipping/labels";
import { ActionButton } from "@/components/admin/action-button";
import { ActionForm } from "@/components/admin/action-form";
import { removeLogoAction, removePaymentsAction, saveDefaultsAction, savePaymentsAction, saveStoreAction, uploadLogoAction } from "./actions";

const yesNo = (v: boolean) => (v ? "yes" : "no");

export default async function StorefrontSettingsPage() {
  const { db, business } = await requireStaff(["ADMIN"]);
  const [store, methods, origin] = await Promise.all([
    db.store.findFirstOrThrow({ where: { kind: "ROOT" }, include: { deliveryMethods: true } }),
    db.deliveryMethod.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    requestOrigin(),
  ]);
  const settings = effectiveSettings(business, store);
  const offered = new Set(store.deliveryMethods.map((d) => d.deliveryMethodId));
  const key = business.stripeSecretKeyEnc ? maskSecret(decryptSecret(business.stripeSecretKeyEnc)) : null;
  const testMode = key?.includes("_test_");

  return (
    <div className="space-y-6">
      <section className="card space-y-4" data-testid="store-settings">
        <h2 className="font-semibold">Store</h2>
        <ActionForm action={saveStoreAction} className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Store name" name="name" value={store.name} required />
            <Field label="Tagline (shown in search results)" name="tagline" value={store.tagline} />
            <div>
              <label className="label" htmlFor="accentColor">Accent color</label>
              <div className="flex items-center gap-2">
                <input className="input w-32 font-mono" id="accentColor" name="accentColor" defaultValue={store.accentColor ?? "#d97706"} placeholder="#d97706" />
                <span className="h-8 w-8 rounded border" style={{ background: store.accentColor ?? "#d97706" }} />
              </div>
            </div>
            <Field label="Announcement bar (optional)" name="announcement" value={store.announcement} placeholder="e.g. Free shipping over $100" />
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
                <option value="">Business default ({ACCOUNT_MODE_LABELS[business.defaultAccountMode].split(" (")[0].toLowerCase()})</option>
                {Object.entries(ACCOUNT_MODE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <TriState label="Show prices" name="showPrices" value={store.showPrices} inherited={business.defaultShowPrices} />
            <TriState label="Allow “place order, pay later”" name="allowPayLater" value={store.allowPayLater} inherited={business.defaultAllowPayLater} />
            <Field label="Access code (blank = public store)" name="accessCode" value={store.accessCode} />
            <div className="sm:col-span-2">
              <span className="label">Default markup on shop items</span>
              <div className="flex gap-2">
                <select className="input w-40" name="markupKind" defaultValue={store.markupKind ?? ""} aria-label="Markup type">
                  <option value="">None</option>
                  <option value="PERCENT">Percent (%)</option>
                  <option value="AMOUNT">Amount ($)</option>
                </select>
                <input className="input w-28" name="markupValue" defaultValue={store.markupValue?.toString() ?? ""} aria-label="Markup value" inputMode="decimal" />
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Now: accounts {ACCOUNT_MODE_LABELS[settings.accountMode].split(" (")[0].toLowerCase()}, prices shown {yesNo(settings.showPrices)}, pay later {yesNo(settings.allowPayLater)}
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

      <section className="card space-y-3">
        <h2 className="font-semibold">Logo</h2>
        <div className="flex flex-wrap items-center gap-4">
          {store.logoFileId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/admin/files/${store.logoFileId}`} alt="Logo" className="h-14 w-auto rounded border" />
          ) : (
            <span className="text-sm text-gray-500">No logo; the store name is shown instead.</span>
          )}
          <ActionForm action={uploadLogoAction} submitLabel="Upload" className="flex items-center gap-2">
            <input className="text-sm" type="file" name="logo" accept="image/png,image/jpeg,image/gif,image/webp" aria-label="Logo file" />
          </ActionForm>
          {store.logoFileId && <ActionButton action={removeLogoAction} fields={{}} label="Remove" className="text-xs text-red-700 hover:underline" />}
        </div>
      </section>

      <section className="card space-y-3" data-testid="payments">
        <h2 className="font-semibold">Card payments (Stripe)</h2>
        {key ? (
          <p className="text-sm">
            Connected with key <span className="font-mono">{key}</span>
            {testMode && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-900">test mode</span>}
            {business.stripeWebhookSecretEnc ? " · webhook set" : <span className="text-amber-700"> · add the webhook signing secret so payments are confirmed even if a shopper closes their browser</span>}
          </p>
        ) : (
          <p className="text-sm text-gray-600">
            Not set up yet. {process.env.NODE_ENV === "production" ? "Shoppers can't pay by card until it is." : "In development, checkout uses a test payment page instead."}
          </p>
        )}
        <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600">
          <li>In your Stripe dashboard, open Developers → API keys and copy the secret key (or a restricted key with Checkout Sessions write access).</li>
          <li>Under Developers → Webhooks, add the endpoint <span className="font-mono text-gray-900">{origin}/api/stripe/webhook</span> for the events checkout.session.completed and checkout.session.async_payment_succeeded, then copy its signing secret.</li>
        </ol>
        <ActionForm action={savePaymentsAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="stripeSecretKey">Secret key</label>
            <input className="input font-mono" id="stripeSecretKey" name="stripeSecretKey" autoComplete="off" placeholder={key ? "Leave blank to keep the current key" : "sk_live_…"} />
          </div>
          <div>
            <label className="label" htmlFor="stripeWebhookSecret">Webhook signing secret</label>
            <input className="input font-mono" id="stripeWebhookSecret" name="stripeWebhookSecret" autoComplete="off" placeholder="whsec_…" />
          </div>
        </ActionForm>
        <p className="text-xs text-gray-500">Keys are stored encrypted and never shown again in full.</p>
        {key && <ActionButton action={removePaymentsAction} fields={{}} label="Disconnect Stripe" confirm="Remove the Stripe keys? Card checkout stops working." className="text-xs text-red-700 hover:underline" />}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Defaults for every store</h2>
        <p className="text-sm text-gray-500">Stores that don&apos;t set their own use these. Affiliate stores (coming next) inherit them too.</p>
        <ActionForm action={saveDefaultsAction} className="grid gap-3 sm:grid-cols-3 sm:items-end">
          <div>
            <label className="label" htmlFor="defaultAccountMode">Shopper accounts</label>
            <select className="input" id="defaultAccountMode" name="defaultAccountMode" defaultValue={business.defaultAccountMode}>
              {Object.entries(ACCOUNT_MODE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="defaultShowPrices" defaultChecked={business.defaultShowPrices} /> Show prices
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="defaultAllowPayLater" defaultChecked={business.defaultAllowPayLater} /> Allow pay later
          </label>
        </ActionForm>
      </section>
    </div>
  );
}

function Field({ label, name, value, required, placeholder }: { label: string; name: string; value: string | null; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input className="input" id={name} name={name} defaultValue={value ?? ""} required={required} placeholder={placeholder} />
    </div>
  );
}

function TriState({ label, name, value, inherited }: { label: string; name: string; value: boolean | null; inherited: boolean }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select className="input" id={name} name={name} defaultValue={value === null ? "" : value ? "on" : "off"}>
        <option value="">Business default ({yesNo(inherited)})</option>
        <option value="on">Yes</option>
        <option value="off">No</option>
      </select>
    </div>
  );
}
