/** "All stores" or a list of stores to tick, for promo and gift codes. */
export function StoreScope({ k, allStores, chosen, stores }: { k: string; allStores: boolean; chosen: string[]; stores: { id: string; name: string; kind: string }[] }) {
  return (
    <fieldset className="text-sm sm:col-span-6">
      <legend className="label">Accepted in</legend>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <label className="flex items-center gap-1.5"><input type="radio" name="scope" value="all" defaultChecked={allStores} /> All stores</label>
        <label className="flex items-center gap-1.5"><input type="radio" name="scope" value="some" defaultChecked={!allStores} /> Only:</label>
        {stores.map((s) => (
          <label key={s.id} className="flex items-center gap-1.5">
            <input type="checkbox" name="storeIds" value={s.id} defaultChecked={chosen.includes(s.id)} aria-label={`${k} ${s.name}`} /> {s.kind === "ROOT" ? `${s.name} (main site)` : s.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
