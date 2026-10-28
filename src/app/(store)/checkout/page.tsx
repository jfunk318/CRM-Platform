import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestStore } from "@/lib/store/resolve";
import { getShopper } from "@/lib/store/accounts";
import { cartTotals, currentCart } from "@/lib/store/cart";
import { checkoutProblem } from "@/lib/store/checkout";
import { DELIVERY_KIND_LABELS } from "@/lib/shipping/labels";
import { ActionForm } from "@/components/admin/action-form";
import { CodeBox } from "@/components/store/codes";
import { money } from "@/components/store/items";
import { CartSummary } from "@/components/store/totals";
import { placeOrderAction, saveCheckoutAction } from "../actions";

export const metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const rs = await getRequestStore();
  if (!rs) notFound();
  const [cart, shopper] = await Promise.all([currentCart(rs), getShopper(rs)]);
  if (!cart || cart.items.length === 0) {
    return (
      <div className="py-8 text-center">
        <p>Your cart is empty. <Link href="/shop" className="text-[var(--accent)] underline">Go shopping</Link></p>
      </div>
    );
  }
  if (rs.settings.accountMode === "REQUIRED" && !shopper) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-8 text-center">
        <h1 className="text-2xl font-bold">Sign in to check out</h1>
        <p className="text-[var(--st-muted)]">This store needs an account to place orders.</p>
        <Link href="/account/login?next=/checkout" className="inline-block st-btn">Sign in or create an account</Link>
      </div>
    );
  }
  const t = await cartTotals(rs.db, rs, cart);
  const problem = checkoutProblem(cart, t);
  const v = {
    email: cart.email ?? shopper?.email ?? "",
    firstName: cart.firstName ?? shopper?.firstName ?? "",
    lastName: cart.lastName ?? shopper?.lastName ?? "",
    phone: cart.phone ?? shopper?.phone ?? "",
  };
  const prices = rs.settings.showPrices || !rs.settings.allowPayLater;
  const saved = !!cart.email;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <section className="space-y-6">
        <h1 className="text-3xl font-bold">Checkout</h1>
        {!shopper && rs.settings.accountMode === "OPTIONAL" && (
          <p className="text-sm text-[var(--st-muted)]">
            Have an account? <Link href="/account/login?next=/checkout" className="text-[var(--accent)] underline">Sign in</Link> — or just check out as a guest.
          </p>
        )}
        <ActionForm action={saveCheckoutAction} submitLabel={saved ? "Update details" : "Continue"} className="space-y-5" key={cart.updatedAt.getTime()}>
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-lg font-semibold">Contact</legend>
            <Field label="Email" name="email" type="email" value={v.email} required autoComplete="email" />
            <Field label="Phone (optional)" name="phone" value={v.phone} autoComplete="tel" />
            <Field label="First name" name="firstName" value={v.firstName} required autoComplete="given-name" />
            <Field label="Last name" name="lastName" value={v.lastName} autoComplete="family-name" />
          </fieldset>
          {t.methods.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="mb-2 text-lg font-semibold">Delivery</legend>
              {t.methods.map((m) => (
                <label key={m.id} className="flex items-start gap-2 rounded-md border border-[var(--st-border)] p-3 text-sm">
                  <input type="radio" name="deliveryMethodId" value={m.id} defaultChecked={(cart.deliveryMethodId ?? t.methods[0].id) === m.id} className="mt-0.5" />
                  <span className="flex-1">
                    <span className="font-medium">{m.name}</span> <span className="text-[var(--st-muted)]">({DELIVERY_KIND_LABELS[m.kind]})</span>
                    {m.description && <span className="block text-[var(--st-muted)]">{m.description}</span>}
                  </span>
                  {prices && <span>{m.price.isZero() ? "Free" : money(m.price)}{m.freeOver && <span className="block text-xs text-[var(--st-muted)]">free over {money(m.freeOver)}</span>}</span>}
                </label>
              ))}
            </fieldset>
          )}
          <fieldset className="grid gap-3 sm:grid-cols-6">
            <legend className="mb-1 text-lg font-semibold">Shipping address</legend>
            <p className="text-sm text-[var(--st-muted)] sm:col-span-6">Only needed if we&apos;re shipping it to you.</p>
            <div className="sm:col-span-3"><Field label="Name" name="shipName" value={cart.shipName ?? ""} autoComplete="name" /></div>
            <div className="sm:col-span-3"><Field label="Street" name="shipLine1" value={cart.shipLine1 ?? ""} autoComplete="address-line1" /></div>
            <div className="sm:col-span-2"><Field label="Apt / suite" name="shipLine2" value={cart.shipLine2 ?? ""} autoComplete="address-line2" /></div>
            <div className="sm:col-span-2"><Field label="City" name="shipCity" value={cart.shipCity ?? ""} autoComplete="address-level2" /></div>
            <div><Field label="State" name="shipRegion" value={cart.shipRegion ?? ""} autoComplete="address-level1" /></div>
            <div><Field label="ZIP" name="shipPostalCode" value={cart.shipPostalCode ?? ""} autoComplete="postal-code" /></div>
          </fieldset>
          <div>
            <label className="label" htmlFor="note">Anything we should know? (optional)</label>
            <textarea className="input min-h-16" id="note" name="note" defaultValue={cart.note ?? ""} />
          </div>
        </ActionForm>
      </section>

      <aside className="space-y-4 self-start rounded-lg border border-[var(--st-border)] p-4" data-testid="checkout-summary">
        <h2 className="font-semibold">Your order</h2>
        <ul className="space-y-1 text-sm">
          {t.lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-2">
              <span>{l.qty} × {l.name} <span className="text-[var(--st-muted)]">({l.detail})</span></span>
              {prices && <span>{money(l.total)}</span>}
            </li>
          ))}
        </ul>
        {prices && <CartSummary t={t} showShipping />}
        <CodeBox cart={cart} t={t} />
        {!saved ? (
          <p className="text-sm text-[var(--st-muted)]">Fill in your details and press Continue to see the total and pay.</p>
        ) : problem ? (
          <p className="text-sm text-[var(--accent)]" role="alert">{problem}</p>
        ) : (
          <div className="space-y-2">
            <ActionForm action={placeOrderAction} submitLabel={t.amountDue.gt(0) ? `Pay ${money(t.amountDue)}` : "Place order"} className="space-y-2">
              {null}
            </ActionForm>
            {rs.settings.allowPayLater && t.amountDue.gt(0) && (
              <ActionForm action={placeOrderAction} submitLabel="Place order, pay later" className="space-y-2">
                <input type="hidden" name="payLater" value="1" />
              </ActionForm>
            )}
            <p className="text-xs text-[var(--st-muted)]">Card payments are handled securely by Stripe.</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function Field(p: { label: string; name: string; value: string; type?: string; required?: boolean; autoComplete?: string }) {
  return (
    <div>
      <label className="label" htmlFor={`co-${p.name}`}>{p.label}</label>
      <input className="input" id={`co-${p.name}`} name={p.name} type={p.type} defaultValue={p.value} required={p.required} autoComplete={p.autoComplete} />
    </div>
  );
}
