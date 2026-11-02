"use client";

import { useEffect, useState } from "react";
import type { ActionResult } from "@/lib/admin/form";
import { slugify } from "@/lib/catalog/products";
import { ActionForm } from "./action-form";
import { FilePicker } from "@/components/file-picker";

export type WebstoreTarget = { id: string; name: string; main: boolean; items: number; fromThisOrder: number };
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
  const [applySettings, setApplySettings] = useState(false);
  const [commissionKind, setCommissionKind] = useState("");
  const theme = template.startsWith("theme:") ? template.slice(6) : null;
  const store = stores.find((s) => s.id === storeId);
  // Settings are chosen for a new store from a look; a store template brings its own.
  const showSettings = mode === "new" ? template.startsWith("theme:") : applySettings;

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
              <div className="grid gap-2 sm:grid-cols-3">
                {choice("new", "Create a new store", "Start fresh from a look or another store's setup.")}
                {choice("add", "Add to a store", "Put these items in a store that's already running.")}
                {choice("overwrite", "Replace a store's items", "Clear a store's items and put these in; optionally its settings too.")}
              </div>

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
                    {!theme && <p className="mt-1 text-xs text-gray-500">Its look, pictures, commission, delivery options, designer and pages are copied. Change them after on the new store&apos;s tabs.</p>}
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
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="applySettings" checked={applySettings} onChange={(e) => setApplySettings(e.target.checked)} />
                    {mode === "overwrite" ? "Also replace this store's settings with the ones below" : "Also change this store's settings"}
                  </label>
                </section>
              )}

              <fieldset className="space-y-1">
                <legend className="label">Items</legend>
                {lines.map((l) => (
                  <label key={l.id} className="flex items-center gap-2">
                    <input type="checkbox" name="lineIds" value={l.id} defaultChecked /> {l.label}
                    {l.qty > 0 && <span className="text-xs text-gray-500">({l.qty} on the quote)</span>}
                  </label>
                ))}
                <p className="text-xs text-gray-500">Each item sells every size its color comes in, priced as a 25-piece batch plus the store&apos;s markup.</p>
              </fieldset>

              {showSettings && (
                <div className="space-y-5 rounded-lg border border-gray-200 p-4" data-testid="ws-settings">
                  <section className="grid gap-3 sm:grid-cols-[1fr_1fr]">
                    <div>
                      <label className="label" htmlFor="ws-commission-kind">Store owner&apos;s commission</label>
                      <select className="input" id="ws-commission-kind" name="commissionKind" value={commissionKind} onChange={(e) => setCommissionKind(e.target.value)}>
                        <option value="">None ($0)</option>
                        <option value="PERCENT">Percentage of sales</option>
                        <option value="PER_PIECE">Flat amount per piece</option>
                      </select>
                    </div>
                    {commissionKind && (
                      <div>
                        <label className="label" htmlFor="ws-commission">{commissionKind === "PERCENT" ? "Percent" : "Dollars per piece"}</label>
                        <div className="flex items-center gap-2">
                          {commissionKind === "PER_PIECE" && <span>$</span>}
                          <input className="input" id="ws-commission" name="commissionValue" inputMode="decimal" placeholder={commissionKind === "PERCENT" ? "10" : "2.00"} required />
                          {commissionKind === "PERCENT" && <span>%</span>}
                        </div>
                      </div>
                    )}
                  </section>

                  <fieldset>
                    <legend className="label">Delivery options shoppers can choose</legend>
                    {deliveries.length === 0 ? (
                      <p className="text-xs text-gray-500">No delivery methods are set up yet (Admin → Delivery methods).</p>
                    ) : (
                      <div className="grid gap-1 sm:grid-cols-2">
                        {deliveries.map((d) => (
                          <label key={d.id} className="flex items-center gap-2">
                            <input type="checkbox" name="deliveryMethodIds" value={d.id} defaultChecked /> {d.name} <span className="text-xs text-gray-500">({d.kind})</span>
                          </label>
                        ))}
                      </div>
                    )}
                    <input type="hidden" name="deliveryShown" value="1" />
                  </fieldset>

                  <section className="space-y-3">
                    <div className="label">Look</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="label" htmlFor="ws-art">Banner</label>
                        <select className="input" id="ws-art" name="heroArt" defaultValue="">
                          <option value="">The look&apos;s own art</option>
                          {arts.filter((a) => !theme || a.theme === theme).map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                          <option value="none">Plain (no art)</option>
                        </select>
                      </div>
                      <div>
                        <label className="label" htmlFor="ws-accent">Accent color</label>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" name="setAccent" id="ws-set-accent" />
                          <input type="color" name="accentColor" defaultValue="#6e3361" aria-label="Accent color" className="h-9 w-14 rounded border border-gray-200" />
                          <label htmlFor="ws-set-accent" className="text-xs text-gray-600">Use this instead of the look&apos;s</label>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <span className="label">Banner picture (instead of art)</span>
                        <FilePicker id="ws-hero" name="hero" accept={IMAGE_ACCEPT} hint="At least 1600 px wide" />
                      </div>
                      <div>
                        <span className="label">Logo</span>
                        <FilePicker id="ws-logo" name="logo" accept={IMAGE_ACCEPT} hint="PNG with a clear background" />
                      </div>
                      <div>
                        <span className="label">Favicon (browser tab)</span>
                        <FilePicker id="ws-favicon" name="favicon" accept={`${IMAGE_ACCEPT},image/x-icon,.ico`} hint="Square, 64 px or more" />
                      </div>
                    </div>
                  </section>
                </div>
              )}
              {theme && mode === "new" && <input type="hidden" name="theme" value={theme} />}
            </ActionForm>
          </div>
        </div>
      )}
    </>
  );
}
