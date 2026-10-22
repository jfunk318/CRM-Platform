import { notFound } from "next/navigation";
import { currentCart } from "@/lib/store/cart";
import { getRequestStore } from "@/lib/store/resolve";
import { ActionForm } from "@/components/admin/action-form";
import { money } from "@/components/store/items";
import { testPaymentAction } from "../../actions";

export const metadata = { robots: { index: false } };

/** Development only: stands in for Stripe when the store has no keys. */
export default async function TestPayment() {
  if (process.env.NODE_ENV === "production") notFound();
  const rs = await getRequestStore();
  if (!rs) notFound();
  const cart = await currentCart(rs);
  if (!cart || cart.status !== "CHECKOUT" || !cart.amountDue) notFound();
  return (
    <div className="mx-auto max-w-md space-y-4 rounded-lg border-2 border-dashed border-amber-400 p-6 text-center">
      <h1 className="text-xl font-bold">Test payment</h1>
      <p className="text-sm text-gray-600">
        This store has no Stripe keys yet, so this development-only page stands in for the card payment. Add keys under
        Storefront → Payments to use real Stripe Checkout.
      </p>
      <div className="text-2xl font-semibold" data-testid="test-amount">{money(cart.amountDue)}</div>
      <ActionForm action={testPaymentAction} submitLabel="Pay (test)" className="flex flex-col items-center gap-2">
        {null}
      </ActionForm>
    </div>
  );
}
