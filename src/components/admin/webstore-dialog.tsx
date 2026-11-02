"use client";

import { useEffect, useState } from "react";
import type { ActionResult } from "@/lib/admin/form";
import { slugify } from "@/lib/catalog/products";
import { ActionForm } from "./action-form";
import { FilePicker } from "@/components/file-picker";

/** A store's current settings, shown (and changeable) in the dialog. */
export type StoreSettings = {
  theme: string;
  commissionKind: string | null;
  commissionValue: string | null;
  /** null = every active delivery method. */
  deliveryIds: string[] | null;
  heroArt: string | null;
  accentColor: string | null;
  hasHero: boolean;
  hasLogo: boolean;
  hasFavicon: boolean;
};
export type WebstoreTarget = { id: string; name: string; main: boolean; items: number; fromThisOrder: number; settings: StoreSettings };
type Option = { key: string; label: string };
type Art = Option & { theme: string };
type Delivery = { id: string; name: string; kind: string };

type Mode = "new" | "add" | "overwrite";
const IMAGE_ACCEPT = "image/png,image/jpeg,image/gif,image/webp";

/**
 * "Create webstore" on a quote or order: a button that opens a dialog to
 * make a new store from a template, add the items to an existing store, or
 * replace an existing store's items (and optionally its settings). The
 * store's commission, delivery options and look are set here too, and stay
 * editable on the store's own tabs.
 */
export function WebstoreDialog({
  action,
  orderId,
  lines,
  stores,
  defaultName,
  themes,
  arts,
  deliveries,
}: {
  action: (prev: ActionResult, form: FormData) => Promise<ActionResult>;
  orderId: string;
  lines: { id: string; label: string; qty: number }[];
  stores: WebstoreTarget[];
  /** From the quote's title (empty if it has none). */
  defaultName: string;
  themes: Option[];
  arts: Art[];
  deliveries: Delivery[];
}) {
  const [open, setOpen] = useState(false);
  const before = stores.find((s) => s.fromThisOrder > 0);
  const [mode, setMode] = useState<Mode>(before ? "add" : "new");
  const [storeId, setStoreId] = useState(before?.id ?? stores[0]?.id ?? "");
  const [name, setName] = useState(defaultName);
  const [slug, setSlug] = useState(slugify(defaultName));
  const [slugTyped, setSlugTyped] = useState(false);
  const [template, setTemplate] = useState(`theme:${themes[0]?.key ?? "minimal"}`);
  const theme = template.startsWith("theme:") ? template.slice(6) : null;
  const store = stores.find((s) => s.id === storeId);
  // The settings shown: the chosen store's, the template store's, or a fresh store's.
  const from = mode === "new" ? (theme ? null : stores.find((s) => `store:${s.id}` === template)) : store;
  const current: StoreSettings = from?.settings ?? { theme: theme ?? "minimal", commissionKind: null, commissionValue: null, deliveryIds: null, heroArt: null, accentColor: null, hasHero: false, hasLogo: false, hasFavicon: false };
  const settingsKey = `${mode}-${from?.id ?? theme}`;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const choice = (value: Mode, title: string, text: string) => (
    <label className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${mode === value ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:border-gray-300"}`}>
      <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-1" disabled={value !== "new" && stores.length === 0} />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-xs text-gray-600">{text}</span>
      </span>
    </label>
  );

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)} data-testid="webstore-open">
        Create webstore
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 md:py-10" role="dialog" aria-modal="true" aria-labelledby="ws-title" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl" data-testid="webstore-dialog">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 id="ws-title" className="text-lg font-bold tracking-tight">Webstore</h2>
              <button type="button" className="text-2xl leading-none text-gray-500 hover:text-gray-900" aria-label="Close" onClick={() => setOpen(false)}>×</button>
            </div>
            <ActionForm action={action} submitLabel={mode === "new" ? "Create store" : mode === "add" ? "Add to store" : "Replace store items"} className="space-y-6 px-6 py-5 text-sm">
              <input type="hidden" name="orderId" value={orderId} />
              <Step n={1} title="What would you like to do?" />
              <div className="grid gap-2 sm:grid-cols-3">
                {choice("new", "Create a new store", "Start fresh from a look or another store's setup.")}
                {choice("add", "Add to a store", "Put these items in a store that's already running.")}
                {choice("overwrite", "Replace a store's items", "Clear a store's items and put these in.")}
              </div>

              <Step n={2} title={mode === "new" ? "The new store" : "Which store"} />
              {mode === "new" ? (
                <section className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="ws-name">Store name</label>
                    <input
                      className="input"
                      id="ws-name"
                      name="storeName"
                      value={name}
                      placeholder="e.g. Tigers Football 2026"
                      required
                      onChange={(e) => {
                        setName(e.target.value);
                        if (!slugTyped) setSlug(slugify(e.target.value));
                      }}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="ws-slug">Address</label>
                    <input className="input" id="ws-slug" name="storeSlug" value={slug} placeholder="tigers-football" onChange={(e) => { setSlug(e.target.value); setSlugTyped(true); }} />
                    <p className="mt-1 text-xs text-gray-500">The store&apos;s subdomain.</p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label" htmlFor="ws-template">Start from</label>
                    <select className="input" id="ws-template" name="template" value={template} onChange={(e) => setTemplate(e.target.value)}>
                      <optgroup label="A fresh store with this look">
                        {themes.map((t) => <option key={t.key} value={`theme:${t.key}`}>{t.label}</option>)}
                      </optgroup>
                      {stores.some((s) => !s.main) && (
                        <optgroup label="A copy of another store's setup (not its items)">
                          {stores.filter((s) => !s.main).map((s) => <option key={s.id} value={`store:${s.id}`}>{s.name}</option>)}
                        </optgroup>
                      )}
                    </select>
                    {!theme && <p className="mt-1 text-xs text-gray-500">Its look, pictures, commission, delivery options, designer and pages are copied (its settings show in step 4, to change if you like).</p>}
                  </div>
                </section>
              ) : (
                <section className="space-y-3">
                  <div>
                    <label className="label" htmlFor="ws-store">Store</label>
                    <select className="input" id="ws-store" name="storeId" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}{s.main ? " (main site)" : ""} · {s.items} item{s.items === 1 ? "" : "s"}
                        </option>
                      ))}
                    </select>
                  </div>
                  {mode === "add" && store && store.fromThisOrder > 0 && (
                    <label className="flex items-start gap-2">
                      <input type="hidden" name="updateShown" value="1" />
                      <input type="checkbox" name="updateExisting" defaultChecked className="mt-0.5" />
                      <span>Update the {store.fromThisOrder} item{store.fromThisOrder === 1 ? "" : "s"} published from this quote before (their names, pictures and price overrides stay). Otherwise they&apos;re added again as new items.</span>
                    </label>
                  )}
                  {mode === "overwrite" && store && (
                    <p className="rounded-md bg-warn-50 px-3 py-2 text-warn-900">The {store.items} item{store.items === 1 ? "" : "s"} in {store.name} now will be removed first. Past orders keep their items.</p>
                  )}
                </section>
              )}

              <Step n={3} title="Items to sell" />
              <fieldset className="space-y-1">
                <legend className="sr-only">Items</legend>
                {lines.map((l) => (
                  <label key={l.id} className="flex items-center gap-2">
                    <input type="checkbox" name="lineIds" value={l.id} defaultChecked /> {l.label}
                    {l.qty > 0 && <span className="text-xs text-gray-500">({l.qty} on the quote)</span>}
                  </label>
                ))}
                <p className="text-xs text-gray-500">Each item sells every size its color comes in, priced as a 25-piece batch plus the store&apos;s markup.</p>
              </fieldset>

              <Step n={4} title="Store settings" note={mode === "new" ? (from ? `Copied from ${from.name}; change anything here.` : "Set up now; all of it can be changed later on the store's tabs.") : `${store?.name ?? "The store"}'s current settings. Change anything here and it's saved with the items.`} />
              <SettingsFields key={settingsKey} current={current} deliveries={deliveries} arts={arts.filter((a) => a.theme === (theme ?? current.theme))} />
              {theme && mode === "new" && <input type="hidden" name="theme" value={theme} />}
            </ActionForm>
          </div>
        </div>
      )}
    </>
  );
}

function Step({ n, title, note }: { n: number; title: string; note?: string }) {
  return (
    <div className="flex items-start gap-3 border-t border-gray-100 pt-5 first:border-0 first:pt-0">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{n}</span>
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        {note && <p className="text-xs text-gray-600">{note}</p>}
      </div>
    </div>
  );
}

/** Commission, delivery options and look, each in its own panel, starting from the store's current values. */
function SettingsFields({ current, deliveries, arts }: { current: StoreSettings; deliveries: Delivery[]; arts: Art[] }) {
  const [commissionKind, setCommissionKind] = useState(current.commissionKind ?? "");
  const [customAccent, setCustomAccent] = useState(!!current.accentColor);
  const panel = "rounded-lg border border-gray-200 bg-gray-50/60 p-4";
  return (
    <div className="grid gap-3 lg:grid-cols-2" data-testid="ws-settings">
      <section className={panel} aria-labelledby="ws-commission-h">
        <h4 id="ws-commission-h" className="mb-2 font-semibold">💰 Commission</h4>
        <div className="space-y-2">
          <select className="input" id="ws-commission-kind" name="commissionKind" aria-label="Commission type" value={commissionKind} onChange={(e) => setCommissionKind(e.target.value)}>
            <option value="">None ($0)</option>
            <option value="PERCENT">Percentage of sales</option>
            <option value="PER_PIECE">Flat amount per piece</option>
          </select>
          {commissionKind && (
            <div className="flex items-center gap-2">
              {commissionKind === "PER_PIECE" && <span>$</span>}
              <input className="input" id="ws-commission" name="commissionValue" inputMode="decimal" aria-label={commissionKind === "PERCENT" ? "Percent" : "Dollars per piece"} defaultValue={current.commissionValue ?? ""} placeholder={commissionKind === "PERCENT" ? "10" : "2.00"} required />
              {commissionKind === "PERCENT" && <span>%</span>}
            </div>
          )}
          <p className="text-xs text-gray-500">What the store&apos;s owner earns on its sales.</p>
        </div>
      </section>

      <section className={panel} aria-labelledby="ws-delivery-h">
        <h4 id="ws-delivery-h" className="mb-2 font-semibold">🚚 Delivery options</h4>
        {deliveries.length === 0 ? (
          <p className="text-xs text-gray-500">No delivery methods are set up yet (Admin → Delivery methods).</p>
        ) : (
          <div className="space-y-1">
            {deliveries.map((d) => (
              <label key={d.id} className="flex items-center gap-2">
                <input type="checkbox" name="deliveryMethodIds" value={d.id} defaultChecked={!current.deliveryIds || current.deliveryIds.includes(d.id)} /> {d.name} <span className="text-xs text-gray-500">({d.kind})</span>
              </label>
            ))}
            <p className="text-xs text-gray-500">Ticked ones are offered at checkout.</p>
          </div>
        )}
        <input type="hidden" name="deliveryShown" value="1" />
      </section>

      <section className={`${panel} lg:col-span-2`} aria-labelledby="ws-look-h">
        <h4 id="ws-look-h" className="mb-2 font-semibold">🎨 Look</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ws-art">Banner art</label>
            <select className="input" id="ws-art" name="heroArt" defaultValue={current.heroArt ?? ""}>
              <option value="">The look&apos;s own art</option>
              {arts.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
              <option value="none">Plain (no art)</option>
            </select>
          </div>
          <fieldset>
            <legend className="label">Accent color</legend>
            <input type="hidden" name="accentShown" value="1" />
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5"><input type="radio" checked={!customAccent} onChange={() => setCustomAccent(false)} /> The look&apos;s</label>
              <label className="flex items-center gap-1.5"><input type="radio" checked={customAccent} onChange={() => setCustomAccent(true)} /> Custom</label>
              {customAccent && (
                <>
                  <input type="hidden" name="setAccent" value="on" />
                  <input type="color" name="accentColor" defaultValue={current.accentColor ?? "#6e3361"} aria-label="Accent color" className="h-9 w-14 rounded border border-gray-200" />
                </>
              )}
            </div>
          </fieldset>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <span className="label">Banner picture {current.hasHero ? "(has one; replace)" : "(instead of art)"}</span>
            <FilePicker id="ws-hero" name="hero" accept={IMAGE_ACCEPT} hint="At least 1600 px wide" />
          </div>
          <div>
            <span className="label">Logo {current.hasLogo && "(has one; replace)"}</span>
            <FilePicker id="ws-logo" name="logo" accept={IMAGE_ACCEPT} hint="PNG with a clear background" />
          </div>
          <div>
            <span className="label">Favicon {current.hasFavicon && "(has one; replace)"}</span>
            <FilePicker id="ws-favicon" name="favicon" accept={`${IMAGE_ACCEPT},image/x-icon,.ico`} hint="Browser-tab icon, square" />
          </div>
        </div>
      </section>
    </div>
  );
}
