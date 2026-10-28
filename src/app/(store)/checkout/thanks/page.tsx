import Link from "next/link";
import { notFound } from "next/navigation";
import { orderRef } from "@/lib/orders/numbers";
import { getRequestStore } from "@/lib/store/resolve";
import { money } from "@/components/store/items";

export const metadata = { title: "Thank you", robots: { index: false } };

export default async function Thanks({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const rs = await getRequestStore();
  const { order: token } = await searchParams;
  if (!rs || !token || token.length < 20) notFound();
  const order = await rs.db.order.findFirst({ where: { publicToken: token }, include: { customer: true } });
  if (!order) notFound();
  return (
    <div className="mx-auto max-w-lg space-y-4 py-8 text-center" data-testid="thanks">
      <h1 className="text-3xl font-bold">Thank you, {order.customer.firstName}!</h1>
      <p className="text-lg">Your order <span className="font-semibold">{orderRef(order)}</span> is in.</p>
      <p className="text-[var(--st-muted)]">
        Total {money(order.total)}{order.paidTotal.gt(0) && <> · paid {money(order.paidTotal)}</>}
        {order.total.gt(order.paidTotal) && <> · balance due {money(order.total.minus(order.paidTotal))}</>}
      </p>
      <p className="text-[var(--st-muted)]">We&apos;ve emailed a confirmation to {order.customer.email}.</p>
      <Link href={`/c/${token}`} className="inline-block st-btn">View your order</Link>
    </div>
  );
}
