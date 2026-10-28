import type { CartTotals } from "@/lib/store/cart";
import { money } from "./items";

/** The money summary for the cart and checkout. */
export function CartSummary({ t, showShipping }: { t: CartTotals; showShipping: boolean }) {
  return (
    <dl className="space-y-1 text-sm" data-testid="cart-summary">
      <Row label={`Items (${t.count})`} value={money(t.merchandise)} />
      {t.discount.gt(0) && <Row label="Discount" value={`−${money(t.discount)}`} className="text-green-700" />}
      {showShipping && <Row label={t.method ? `Delivery: ${t.method.name}` : "Delivery"} value={t.method ? (t.shipping.isZero() ? "Free" : money(t.shipping)) : "Choose at checkout"} />}
      {showShipping && <Row label="Tax" value={money(t.tax)} />}
      <div className="flex justify-between border-t border-[var(--st-border)] pt-1 text-base font-semibold">
        <dt>Total</dt>
        <dd data-testid="cart-total">{money(showShipping ? t.total : t.merchandise.minus(t.discount))}</dd>
      </div>
      {t.gift.gt(0) && <Row label="Gift code" value={`−${money(t.gift)}`} className="text-green-700" />}
      {t.gift.gt(0) && showShipping && (
        <div className="flex justify-between font-semibold">
          <dt>To pay</dt>
          <dd data-testid="amount-due">{money(t.amountDue)}</dd>
        </div>
      )}
    </dl>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex justify-between ${className ?? ""}`}>
      <dt className="text-[var(--st-muted)]">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
