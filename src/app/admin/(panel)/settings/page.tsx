import type { TaxRate } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { toPercentInput } from "@/lib/admin/form";
import { ActionForm } from "@/components/admin/action-form";
import { deleteTaxRate, saveShopSettings, saveTaxRate } from "./actions";

const TAX_FLAGS: [keyof TaxRate, string][] = [
  ["taxScreenSetupFee", "Screen setup fees"],
  ["taxArtworkFee", "Artwork fees"],
  ["taxDigitizingFee", "Digitizing fees"],
  ["taxRushFee", "Rush fees"],
  ["taxShipping", "Shipping"],
  ["taxPaymentSurcharge", "Card surcharge"],
];

export default async function SettingsPage() {
  await requireStaff(["ADMIN"]);
  const [settings, rates] = await Promise.all([
    db.shopSettings.findUnique({ where: { id: 1 } }),
    db.taxRate.findMany({ orderBy: [{ country: "asc" }, { region: "asc" }, { name: "asc" }] }),
  ]);

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="page-title">Shop settings</h1>
        <div className="card">
          <ActionForm action={saveShopSettings}>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="shopName">Shop name</label>
                <input className="input" id="shopName" name="shopName" defaultValue={settings?.shopName ?? "Beeze Tees"} required />
              </div>
              <div>
                <label className="label" htmlFor="primaryDomain">Main domain</label>
                <input className="input" id="primaryDomain" name="primaryDomain" defaultValue={settings?.primaryDomain ?? "beezetees.com"} required />
                <p className="mt-1 text-xs text-gray-500">
                  Stores will live at <span className="font-mono">storename.{settings?.primaryDomain ?? "beezetees.com"}</span>
                </p>
              </div>
              <div>
                <label className="label" htmlFor="currency">Currency</label>
                <input className="input" id="currency" name="currency" defaultValue={settings?.currency ?? "USD"} required />
              </div>
              <div>
                <label className="label" htmlFor="priceRounding">Unit price rounding</label>
                <select className="input" id="priceRounding" name="priceRounding" defaultValue={settings?.priceRounding ?? "CENT"}>
                  <option value="CENT">Nearest cent</option>
                  <option value="UP_TO_99">Up to .99</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="rushFeePct">Rush fee (% of merchandise)</label>
                <input className="input" id="rushFeePct" name="rushFeePct" defaultValue={toPercentInput(settings?.rushFeePct)} placeholder="0" />
              </div>
              <div>
                <label className="label" htmlFor="paymentSurchargePct">Card surcharge (%)</label>
                <input className="input" id="paymentSurchargePct" name="paymentSurchargePct" defaultValue={toPercentInput(settings?.paymentSurchargePct)} placeholder="0" />
              </div>
            </div>
          </ActionForm>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="page-title">Sales tax</h2>
          <p className="text-sm text-gray-500">
            A rate applies when the ship-to address matches its country, state and (optionally) ZIP prefixes.
            Merchandise is always taxed; choose which fees are taxed too.
          </p>
        </div>
        {rates.length === 0 && <p className="text-sm text-gray-500">No tax rates yet.</p>}
        {rates.map((r) => <TaxRateCard key={r.id} rate={r} />)}
        <TaxRateCard />
      </section>
    </div>
  );
}

function TaxRateCard({ rate }: { rate?: TaxRate }) {
  const key = rate?.id ?? "new";
  return (
    <div className="card space-y-3">
      {!rate && <h3 className="font-semibold">Add a tax rate</h3>}
      <ActionForm action={saveTaxRate} submitLabel={rate ? "Save" : "Add tax rate"} resetOnSuccess={!rate}>
        {rate && <input type="hidden" name="id" value={rate.id} />}
        <div className="grid gap-3 sm:grid-cols-5">
          <div className="sm:col-span-2">
            <label className="label" htmlFor={`tn-${key}`}>Name</label>
            <input className="input" id={`tn-${key}`} name="name" defaultValue={rate?.name} placeholder="e.g. MA sales tax" required />
          </div>
          <div>
            <label className="label" htmlFor={`tr-${key}`}>Rate (%)</label>
            <input className="input" id={`tr-${key}`} name="rate" defaultValue={toPercentInput(rate?.rate)} placeholder="6.25" required />
          </div>
          <div>
            <label className="label" htmlFor={`tc-${key}`}>Country</label>
            <input className="input" id={`tc-${key}`} name="country" defaultValue={rate?.country ?? "US"} />
          </div>
          <div>
            <label className="label" htmlFor={`tg-${key}`}>State</label>
            <input className="input" id={`tg-${key}`} name="region" defaultValue={rate?.region ?? ""} placeholder="all" />
          </div>
          <div className="sm:col-span-5">
            <label className="label" htmlFor={`tp-${key}`}>ZIP prefixes (optional, comma separated)</label>
            <input className="input" id={`tp-${key}`} name="postalPrefixes" defaultValue={rate?.postalPrefixes.join(", ")} placeholder="e.g. 013, 014" />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <span className="text-gray-500">Also tax:</span>
          {TAX_FLAGS.map(([flag, label]) => (
            <label key={flag} className="flex items-center gap-1.5">
              <input type="checkbox" name={flag} defaultChecked={rate ? Boolean(rate[flag]) : flag !== "taxShipping" && flag !== "taxPaymentSurcharge"} />
              {label}
            </label>
          ))}
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="active" defaultChecked={rate?.active ?? true} /> Active
          </label>
        </div>
      </ActionForm>
      {rate && (
        <ActionForm action={deleteTaxRate} submitLabel="Delete" danger confirm={`Delete ${rate.name}?`}>
          <input type="hidden" name="id" value={rate.id} />
        </ActionForm>
      )}
    </div>
  );
}
