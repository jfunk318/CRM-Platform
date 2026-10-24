"use client";

import { useState } from "react";

export type PublishStore = { id: string; name: string; main: boolean; items: number; fromThisOrder: number };

/** Fields for publishing a quote's/order's items to a store (inside an <ActionForm>). */
export function PublishToStoreFields({
  lines,
  stores,
  defaultName,
  defaultSlug,
}: {
  lines: { id: string; label: string; qty: number }[];
  stores: PublishStore[];
  defaultName: string;
  defaultSlug: string;
}) {
  // Default to a store this order was published to before, else a new one.
  const [target, setTarget] = useState(stores.find((s) => s.fromThisOrder > 0)?.id ?? "new");
  const [mode, setMode] = useState<"update" | "overwrite">("update");
  const store = stores.find((s) => s.id === target);

  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="label" htmlFor="pub-target">Store</label>
        <select className="input" id="pub-target" name="target" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="new">New store…</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}{s.main ? " (main site)" : ""} · {s.items} item{s.items === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </div>

      {target === "new" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="pub-name">Store name</label>
            <input className="input" id="pub-name" name="storeName" defaultValue={defaultName} required />
          </div>
          <div>
            <label className="label" htmlFor="pub-slug">Address</label>
            <input className="input" id="pub-slug" name="storeSlug" defaultValue={defaultSlug} placeholder="tigers-football" />
            <p className="mt-1 text-xs text-gray-500">The store&apos;s subdomain. It&apos;s for this customer, and you manage it.</p>
          </div>
        </div>
      ) : (
        store && (
          <fieldset className="space-y-1">
            <legend className="label">What happens to the store&apos;s items</legend>
            <label className="flex items-start gap-2">
              <input type="radio" name="mode" value="update" checked={mode === "update"} onChange={() => setMode("update")} className="mt-1" />
              <span>
                Add these items{store.fromThisOrder > 0 && <>, and update the {store.fromThisOrder} published from this order before (their names, pictures and price overrides stay)</>}
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name="mode" value="overwrite" checked={mode === "overwrite"} onChange={() => setMode("overwrite")} className="mt-1" />
              <span>
                Replace everything: remove the {store.items} item{store.items === 1 ? "" : "s"} there now, then add these
              </span>
            </label>
          </fieldset>
        )
      )}

      <fieldset className="space-y-1">
        <legend className="label">Items</legend>
        {lines.map((l) => (
          <label key={l.id} className="flex items-center gap-2">
            <input type="checkbox" name="lineIds" value={l.id} defaultChecked /> {l.label}
            <span className="text-xs text-gray-500">({l.qty} ordered)</span>
          </label>
        ))}
      </fieldset>

      <div className="max-w-xs">
        <label className="label" htmlFor="pub-batch">Price as a batch of</label>
        <input className="input" id="pub-batch" name="batchQty" inputMode="numeric" placeholder="the quantity ordered" />
        <p className="mt-1 text-xs text-gray-500">Each item sells every size its color comes in, priced at this quantity&apos;s price break plus the store&apos;s markup.</p>
      </div>
    </div>
  );
}
