import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestStore } from "@/lib/store/resolve";
import { itemPrice } from "@/lib/store/settings";
import { offersPersonalization } from "@/lib/store/personalization";
import { ActionForm } from "@/components/admin/action-form";
import { itemImage, money, priceRange, shopItemsInclude } from "@/components/store/items";
import { addToCartAction } from "../../actions";

async function load(slug: string) {
  const rs = await getRequestStore();
  if (!rs) return null;
  const item = await rs.db.storeItem.findFirst({
    where: { storeId: rs.store.id, slug, published: true },
    include: { ...shopItemsInclude, prices: { include: { size: true }, orderBy: { size: { sortOrder: "asc" } } }, design: { include: { ...shopItemsInclude.design.include, decorations: { orderBy: { sortOrder: "asc" } } } } },
  });
  return item ? { rs, item } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const found = await load((await params).slug);
  return found ? { title: `${found.item.name} · ${found.rs.store.name}`, description: found.item.description ?? undefined } : {};
}

export default async function ItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const found = await load((await params).slug);
  if (!found) notFound();
  const { rs, item } = found;
  const img = itemImage(item);
  const showPrices = rs.settings.showPrices;
  const product = item.design.product;
  const personal = offersPersonalization(item);
  // Structured data for search engines.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.name,
    description: item.description ?? undefined,
    brand: product.brand ?? undefined,
    ...(showPrices && item.prices.length
      ? { offers: { "@type": "AggregateOffer", priceCurrency: rs.business.currency, lowPrice: Math.min(...item.prices.map((p) => itemPrice(p, item, rs.store).toNumber())), highPrice: Math.max(...item.prices.map((p) => itemPrice(p, item, rs.store).toNumber())) } }
      : {}),
  };
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-gray-100">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <span className="h-24 w-24 rounded-full border" style={{ background: item.design.color.hex ?? "#e5e7eb" }} />
        )}
      </div>
      <div className="space-y-4">
        <Link href="/shop" className="text-sm text-[var(--accent)] hover:underline">← Shop</Link>
        <h1 className="text-3xl font-bold">{item.name}</h1>
        {showPrices && <div className="text-xl font-semibold" data-testid="price-range">{priceRange(item, rs.store)}</div>}
        <div className="text-gray-700">
          {product.brand ? `${product.brand} ` : ""}{product.name} · {item.design.color.name}
        </div>
        {item.description && <p className="whitespace-pre-wrap text-gray-700">{item.description}</p>}
        {item.design.decorations.length > 0 && (
          <ul className="text-sm text-gray-600">
            {item.design.decorations.map((d) => <li key={d.id}>{d.location}</li>)}
          </ul>
        )}
        {personal ? (
          // Personalized: one name/number at a time, so each gets its own cart line.
          <ActionForm action={addToCartAction} submitLabel="Add to cart" resetOnSuccess className="space-y-4 rounded-lg border border-gray-200 p-4">
            <input type="hidden" name="itemId" value={item.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="buy-size">Size</label>
                <select className="input" id="buy-size" name="size" required defaultValue="">
                  <option value="" disabled>Choose a size</option>
                  {item.prices.map((p) => (
                    <option key={p.id} value={p.sizeId}>
                      {p.size.code}{showPrices ? ` · ${money(itemPrice(p, item, rs.store))}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="buy-qty">Quantity</label>
                <input className="input" id="buy-qty" name="qty" inputMode="numeric" defaultValue="1" required />
              </div>
              {item.nameMode !== "OFF" && (
                <div>
                  <label className="mb-1 block text-sm font-medium" htmlFor="buy-name">
                    Name{item.nameMode === "OPTIONAL" && <span className="font-normal text-gray-500"> (optional)</span>}
                    {showPrices && !item.namePrice.isZero() && <span className="font-normal text-gray-500"> +{money(item.namePrice)}</span>}
                  </label>
                  <input className="input" id="buy-name" name="personalName" maxLength={item.nameMaxLength} required={item.nameMode === "REQUIRED"} autoComplete="off" />
                  <p className="mt-1 text-xs text-gray-500">Up to {item.nameMaxLength} letters, printed as typed.</p>
                </div>
              )}
              {item.numberMode !== "OFF" && (
                <div>
                  <label className="mb-1 block text-sm font-medium" htmlFor="buy-number">
                    Number{item.numberMode === "OPTIONAL" && <span className="font-normal text-gray-500"> (optional)</span>}
                    {showPrices && !item.numberPrice.isZero() && <span className="font-normal text-gray-500"> +{money(item.numberPrice)}</span>}
                  </label>
                  <input className="input" id="buy-number" name="personalNumber" inputMode="numeric" maxLength={item.numberMaxDigits} pattern="[0-9]*" required={item.numberMode === "REQUIRED"} autoComplete="off" />
                </div>
              )}
            </div>
            {item.personalizationLocation && <p className="text-xs text-gray-500">Printed on the {item.personalizationLocation.toLowerCase()}.</p>}
          </ActionForm>
        ) : (
        <ActionForm action={addToCartAction} submitLabel="Add to cart" className="space-y-4 rounded-lg border border-gray-200 p-4">
          <input type="hidden" name="itemId" value={item.id} />
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Sizes and quantities</legend>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {item.prices.map((p) => (
                <label key={p.id} className="text-sm">
                  <span className="block font-medium">{p.size.code}</span>
                  {showPrices && <span className="block text-xs text-gray-500">{money(itemPrice(p, item, rs.store))}</span>}
                  <input className="input mt-1" name={`qty_${p.sizeId}`} inputMode="numeric" placeholder="0" aria-label={`Quantity ${p.size.code}`} />
                </label>
              ))}
            </div>
          </fieldset>
        </ActionForm>
        )}
        <Link href="/cart" className="inline-block text-sm text-[var(--accent)] hover:underline">View cart →</Link>
        {product.sizeChartImageUrl && /^https:\/\//.test(product.sizeChartImageUrl) && (
          <details className="text-sm">
            <summary className="cursor-pointer text-[var(--accent)]">Size chart</summary>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.sizeChartImageUrl} alt="Size chart" className="mt-2 max-w-full" />
          </details>
        )}
      </div>
    </div>
  );
}
