import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestStore } from "@/lib/store/resolve";
import { cartTotals, currentCart } from "@/lib/store/cart";
import { ActionForm } from "@/components/admin/action-form";
import { CodeBox } from "@/components/store/codes";
import { money } from "@/components/store/items";
import { CartSummary } from "@/components/store/totals";
import { updateCartAction } from "../actions";

export const metadata = { title: "Cart", robots: { index: false } };

export default async function CartPage() {
  const rs = await getRequestStore();
  if (!rs) notFound();
  const cart = await currentCart(rs);
  const t = cart && cart.items.length ? await cartTotals(rs.db, rs, cart) : null;
  const prices = rs.settings.showPrices || !rs.settings.allowPayLater;
  if (!cart || !t) {
    return (
      <div className="space-y-3 py-8 text-center">
        <h1 className="text-3xl font-bold">Your cart is empty</h1>
        <Link href="/shop" className="text-[var(--accent)] underline">Keep shopping</Link>
      </div>
    );
  }
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold">Cart</h1>
        <ul className="divide-y divide-gray-200 border-y border-gray-200" data-testid="cart-lines">
          {t.lines.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-4 py-4">
              <div className="h-16 w-16 overflow-hidden rounded bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {l.imageFileId && <img src={`/media/${l.imageFileId}`} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-40 flex-1">
                <Link href={`/shop/${l.slug}`} className="font-medium hover:underline">{l.name}</Link>
                <div className="text-sm text-gray-600">{l.detail}{prices && ` · ${money(l.unitPrice)} each`}</div>
                {!l.available && <div className="text-sm text-red-600">No longer available</div>}
              </div>
              <ActionForm key={`${l.id}-${l.qty}`} action={updateCartAction} submitLabel="Update" className="flex items-center gap-2">
                <input type="hidden" name="cartItemId" value={l.id} />
                <input className="input w-16" name="qty" defaultValue={l.qty} inputMode="numeric" aria-label={`Quantity of ${l.name} ${l.detail}`} />
              </ActionForm>
              {prices && <div className="w-20 text-right font-semibold">{money(l.total)}</div>}
            </li>
          ))}
        </ul>
        <Link href="/shop" className="text-sm text-[var(--accent)] hover:underline">← Keep shopping</Link>
      </section>
      <aside className="space-y-4 rounded-lg border border-gray-200 p-4">
        {prices && <CartSummary t={t} showShipping={false} />}
        <CodeBox cart={cart} t={t} />
        <Link href="/checkout" className="block rounded-md bg-[var(--accent)] px-4 py-2.5 text-center font-semibold text-white" data-testid="to-checkout">Checkout</Link>
      </aside>
    </div>
  );
}
