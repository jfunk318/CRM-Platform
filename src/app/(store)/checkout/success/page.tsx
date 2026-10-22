import { notFound, redirect } from "next/navigation";
import { requestOrigin } from "@/lib/business";
import { stripeKeys } from "@/lib/payments/stripe";
import { completeCheckoutSession } from "@/lib/store/checkout";
import { getRequestStore } from "@/lib/store/resolve";

export const metadata = { robots: { index: false } };

/** Back from Stripe: finish the order now (the webhook may not have arrived yet). */
export default async function CheckoutSuccess({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const rs = await getRequestStore();
  const { session_id } = await searchParams;
  if (!rs || !session_id) notFound();
  const keys = stripeKeys(rs.business);
  if (!keys) notFound();
  const order = await completeCheckoutSession(rs.db, keys, session_id, await requestOrigin());
  if (order && "publicToken" in order && order.publicToken) redirect(`/checkout/thanks?order=${order.publicToken}`);
  return (
    <div className="mx-auto max-w-md space-y-3 py-12 text-center">
      <h1 className="text-2xl font-bold">Finishing your order…</h1>
      <p className="text-gray-600">Your payment is being confirmed. You&apos;ll get an email as soon as it&apos;s done; you can refresh this page in a moment.</p>
    </div>
  );
}
