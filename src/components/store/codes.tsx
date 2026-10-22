import type { CartWithItems, CartTotals } from "@/lib/store/cart";
import { ActionButton } from "@/components/admin/action-button";
import { ActionForm } from "@/components/admin/action-form";
import { applyCodeAction, removeCodeAction } from "@/app/(store)/actions";

/** Enter or remove a promo or gift code. */
export function CodeBox({ cart, t }: { cart: CartWithItems; t: CartTotals }) {
  return (
    <div className="space-y-2 text-sm" data-testid="codes">
      {cart.promoCode && (
        <div className="flex items-center justify-between gap-2">
          <span>
            Promo <span className="font-mono">{cart.promoCode.code}</span>
            {t.promoError ? <span className="text-red-600"> · {t.promoError}</span> : cart.promoCode.description ? <span className="text-gray-500"> · {cart.promoCode.description}</span> : null}
          </span>
          <ActionButton action={removeCodeAction} fields={{ which: "promo" }} label="Remove" className="text-xs text-red-700 hover:underline" />
        </div>
      )}
      {cart.giftCode && (
        <div className="flex items-center justify-between gap-2">
          <span>
            Gift code <span className="font-mono">{cart.giftCode.code}</span>
            {t.giftError ? <span className="text-red-600"> · {t.giftError}</span> : <span className="text-gray-500"> · ${cart.giftCode.balance.toFixed(2)} balance</span>}
          </span>
          <ActionButton action={removeCodeAction} fields={{ which: "gift" }} label="Remove" className="text-xs text-red-700 hover:underline" />
        </div>
      )}
      <ActionForm action={applyCodeAction} submitLabel="Apply" resetOnSuccess className="flex items-center gap-2">
        <input className="input" name="code" placeholder="Promo or gift code" aria-label="Promo or gift code" autoComplete="off" />
      </ActionForm>
    </div>
  );
}
