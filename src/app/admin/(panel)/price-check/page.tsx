import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { priceLineItem, priceOrder } from "@/lib/pricing";
import { type DecorationRequest, LineRequestError, loadLineItemInput, loadTaxRates } from "@/lib/pricing/load";
import { DIMENSION_UNIT } from "@/lib/catalog/methods";

type Params = Record<string, string | undefined>;
const DECORATION_SLOTS = 3;
const money = (v: { toFixed(n: number): string }) => `$${v.toFixed(2)}`;
const num = (v: string | undefined) => (v && Number.isFinite(Number(v)) ? Number(v) : undefined);

/**
 * Staff tool: price a product + decorations exactly as checkout will,
 * to check that catalog costs, markups and price tables are right.
 */
export default async function PriceCheckPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { db, business: settings } = await requireStaff(["SALES"]);
  const sp = await searchParams;
  const products = await db.product.findMany({
    where: { variants: { some: {} } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, styleCode: true },
  });
  const product = sp.product
    ? await db.product.findUnique({
        where: { id: sp.product },
        include: {
          colors: { orderBy: { sortOrder: "asc" } },
          sizes: { orderBy: { sortOrder: "asc" } },
          variants: true,
          views: { orderBy: { sortOrder: "asc" }, include: { areas: true } },
          productType: { include: { decorationMethods: { include: { method: true } } } },
          methodRules: true,
        },
      })
    : null;
  const groups = await db.pricingGroup.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] });

  const colorId = sp.color ?? product?.colors[0]?.id ?? "";
  const methods =
    product?.productType.decorationMethods
      .map((d) => d.method)
      .filter((m) => m.active && product.methodRules.find((r) => r.methodId === m.id)?.enabled !== false)
      .sort((a, b) => a.sortOrder - b.sortOrder) ?? [];
  const locations = product?.views.flatMap((v) => v.areas.map((a) => `${v.name} / ${a.name}`)) ?? [];

  // Price it if the form was submitted.
  let result: { line: ReturnType<typeof priceLineItem>; totals: ReturnType<typeof priceOrder> } | null = null;
  let error: string | null = null;
  if (product && sp.go) {
    const quantities = Object.fromEntries(product.sizes.map((s) => [s.id, num(sp[`qty_${s.id}`]) ?? 0]));
    const decorations: DecorationRequest[] = [];
    for (let i = 0; i < DECORATION_SLOTS; i++) {
      if (!sp[`m${i}`]) continue;
      decorations.push({
        methodId: sp[`m${i}`]!,
        location: sp[`loc${i}`] || `Location ${i + 1}`,
        colors: num(sp[`colors${i}`]),
        stitches: num(sp[`stitches${i}`]),
        widthIn: num(sp[`w${i}`]),
        heightIn: num(sp[`h${i}`]),
        needsArtwork: sp[`art${i}`] === "on",
        needsDigitizing: sp[`dig${i}`] === "on",
        reuseScreens: sp[`reuse${i}`] === "on",
      });
    }
    try {
      const input = await loadLineItemInput(db, { productId: product.id, colorId, quantities, decorations, pricingGroupId: sp.group });
      const line = priceLineItem(input);
      const taxRates = sp.state ? await loadTaxRates(db, { country: "US", region: sp.state, postalCode: sp.zip }) : [];
      const totals = priceOrder({
        lines: [line],
        shipping: num(sp.shipping) ?? 0,
        rushFeePct: sp.rush === "on" ? settings.rushFeePct.toString() : 0,
        paymentSurchargePct: sp.card === "on" ? settings.paymentSurchargePct.toString() : 0,
        taxRates,
      });
      result = { line, totals };
    } catch (e) {
      if (!(e instanceof LineRequestError)) throw e;
      error = e.message;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Price check</h1>
        <p className="text-sm text-gray-500">Price an order the same way the store and quotes will, using the current catalog and price tables.</p>
      </div>

      <form className="card flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <label className="label" htmlFor="product">Product</label>
          <select className="input" id="product" name="product" defaultValue={product?.id ?? ""}>
            <option value="" disabled>Choose a product…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.styleCode})</option>)}
          </select>
        </div>
        <button className="btn-secondary">Choose</button>
        {products.length === 0 && (
          <p className="w-full text-sm text-gray-500">
            No products with costs yet. <Link href="/admin/products" className="text-amber-700 underline">Add one</Link>.
          </p>
        )}
      </form>

      {product && (
        <form className="card space-y-4">
          <input type="hidden" name="product" value={product.id} />
          <input type="hidden" name="go" value="1" />
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="color">Color</label>
              <select className="input" id="color" name="color" defaultValue={colorId}>
                {product.colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="group">Pricing group</label>
              <select className="input" id="group" name="group" defaultValue={sp.group ?? ""}>
                <option value="">Default</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="label">Quantities</div>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((s) => (
                <div key={s.id} className="w-20">
                  <label className="text-xs text-gray-500" htmlFor={`qty_${s.id}`}>{s.code}</label>
                  <input className="input" id={`qty_${s.id}`} name={`qty_${s.id}`} defaultValue={sp[`qty_${s.id}`] ?? ""} placeholder="0" />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="label">Decorations</div>
            {Array.from({ length: DECORATION_SLOTS }, (_, i) => (
              <div key={i} className="grid gap-2 rounded-md border border-gray-100 p-2 sm:grid-cols-8 sm:items-end">
                <div className="sm:col-span-2">
                  <label className="text-xs text-gray-500" htmlFor={`m${i}`}>Method</label>
                  <select className="input" id={`m${i}`} name={`m${i}`} defaultValue={sp[`m${i}`] ?? ""}>
                    <option value="">{i === 0 ? "None (blank)" : "—"}</option>
                    {methods.map((m) => (
                      <option key={m.id} value={m.id}>{m.shortName} ({DIMENSION_UNIT[m.pricingModel] ?? "flat"})</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-gray-500" htmlFor={`loc${i}`}>Location</label>
                  <input className="input" id={`loc${i}`} name={`loc${i}`} list="locations" defaultValue={sp[`loc${i}`] ?? ""} placeholder="Front" />
                </div>
                <SmallInput label="Ink colors" name={`colors${i}`} sp={sp} />
                <SmallInput label="Stitches" name={`stitches${i}`} sp={sp} />
                <SmallInput label="Width in" name={`w${i}`} sp={sp} />
                <SmallInput label="Height in" name={`h${i}`} sp={sp} />
                <div className="flex flex-wrap gap-3 text-xs sm:col-span-8">
                  <Check label="Needs artwork" name={`art${i}`} sp={sp} />
                  <Check label="Needs digitizing" name={`dig${i}`} sp={sp} />
                  <Check label="Reuse existing screens" name={`reuse${i}`} sp={sp} />
                </div>
              </div>
            ))}
            <datalist id="locations">{locations.map((l) => <option key={l} value={l} />)}</datalist>
          </div>

          <div className="grid gap-3 sm:grid-cols-6 sm:items-end">
            <SmallInput label="Shipping $" name="shipping" sp={sp} />
            <SmallInput label="Ship-to state" name="state" sp={sp} placeholder="NH" />
            <SmallInput label="ZIP" name="zip" sp={sp} />
            <div className="flex gap-3 text-xs sm:col-span-3">
              <Check label="Rush" name="rush" sp={sp} />
              <Check label="Card surcharge" name="card" sp={sp} />
            </div>
          </div>
          <button className="btn">Calculate</button>
        </form>
      )}

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {result && <Breakdown {...result} />}
    </div>
  );
}

function Breakdown({ line, totals }: { line: ReturnType<typeof priceLineItem>; totals: ReturnType<typeof priceOrder> }) {
  return (
    <div className="card space-y-4" data-testid="breakdown">
      {line.issues.length > 0 && (
        <ul className="space-y-1 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {line.issues.map((i, n) => (
            <li key={n}>{i.location ? `${i.location}: ` : ""}{i.message}</li>
          ))}
        </ul>
      )}
      <table className="table">
        <thead>
          <tr>
            <th>Size</th>
            <th>Qty</th>
            <th>Garment</th>
            <th>Decoration</th>
            <th>Discount</th>
            <th>Each</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {line.sizes.map((s) => (
            <tr key={s.sizeCode}>
              <td>{s.sizeCode}</td>
              <td>{s.qty}</td>
              <td>{money(s.blankUnit)}</td>
              <td>{money(s.decorationUnit)}</td>
              <td>{s.discountPct.isZero() ? "—" : `${s.discountPct.times(100).toString()}%`}</td>
              <td className="font-medium">{money(s.unitPrice)}</td>
              <td>{money(s.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {line.decorations.length > 0 && (
        <p className="text-sm text-gray-600">
          Decoration per piece: {line.decorations.map((d) => `${d.location} (${d.methodCode}) ${money(d.unitPrice)}`).join(" · ")}
        </p>
      )}
      <table className="ml-auto w-full max-w-sm text-sm">
        <tbody>
          <Row label={`Merchandise (${line.totalQty} pcs)`} value={money(totals.merchandise)} />
          {line.fees.map((f, i) => (
            <Row key={i} label={`${f.location}: ${f.description}`} value={money(f.amount)} />
          ))}
          {!totals.rushFee.isZero() && <Row label="Rush" value={money(totals.rushFee)} />}
          {!totals.shipping.isZero() && <Row label="Shipping" value={money(totals.shipping)} />}
          {!totals.paymentSurcharge.isZero() && <Row label="Card surcharge" value={money(totals.paymentSurcharge)} />}
          {totals.taxes.map((t) => (
            <Row key={t.name} label={`${t.name} on ${money(t.taxable)}`} value={money(t.amount)} />
          ))}
          <tr className="border-t border-gray-200 font-semibold">
            <td className="py-1">Total</td>
            <td className="py-1 text-right" data-testid="total">{money(totals.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="py-0.5 text-gray-600">{label}</td>
      <td className="py-0.5 text-right">{value}</td>
    </tr>
  );
}

function SmallInput({ label, name, sp, placeholder }: { label: string; name: string; sp: Params; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-gray-500" htmlFor={name}>{label}</label>
      <input className="input" id={name} name={name} defaultValue={sp[name] ?? ""} placeholder={placeholder} />
    </div>
  );
}

function Check({ label, name, sp }: { label: string; name: string; sp: Params }) {
  return (
    <label className="flex items-center gap-1.5">
      <input type="checkbox" name={name} defaultChecked={sp[name] === "on"} /> {label}
    </label>
  );
}
