import type { AccountMode, Business, DeliveryMethod, MarkupKind, Prisma, Store } from "@prisma/client";

/** What a store does, after inheriting from the business (and later its group). */
export type StoreSettings = {
  accountMode: AccountMode;
  showPrices: boolean;
  allowPayLater: boolean;
  needsAccessCode: boolean;
};

type Level = { accountMode?: AccountMode | null; showPrices?: boolean | null; allowPayLater?: boolean | null };

/** Business defaults, then each level down overrides what it sets. */
export function effectiveSettings(business: Business, store: Store, group?: Level | null): StoreSettings {
  const levels: Level[] = [
    { accountMode: business.defaultAccountMode, showPrices: business.defaultShowPrices, allowPayLater: business.defaultAllowPayLater },
    group ?? {},
    store,
  ];
  const pick = <K extends keyof Level>(k: K) => levels.reduce<Level[K]>((v, l) => (l[k] ?? v) as Level[K], undefined)!;
  return {
    accountMode: pick("accountMode") as AccountMode,
    showPrices: pick("showPrices") as boolean,
    allowPayLater: pick("allowPayLater") as boolean,
    needsAccessCode: !!store.accessCode,
  };
}

export const ACCOUNT_MODE_LABELS: Record<AccountMode, string> = {
  OPTIONAL: "Optional (sign in or check out as a guest)",
  REQUIRED: "Required to check out",
  GUEST_ONLY: "Guest checkout only (no accounts)",
};

/** The delivery methods a store offers. */
export function offeredMethods(store: Store & { deliveryMethods: { deliveryMethodId: string }[] }, all: DeliveryMethod[]): DeliveryMethod[] {
  const active = all.filter((m) => m.active);
  if (!store.customDeliveryMethods) return active;
  const ids = new Set(store.deliveryMethods.map((d) => d.deliveryMethodId));
  return active.filter((m) => ids.has(m.id));
}

/** An item's price for one size: (override or base) plus the item's or store's markup. */
export function itemPrice(
  price: { basePrice: Prisma.Decimal; overridePrice: Prisma.Decimal | null },
  item: { markupKind: MarkupKind | null; markupValue: Prisma.Decimal | null },
  store: { markupKind: MarkupKind | null; markupValue: Prisma.Decimal | null },
): Prisma.Decimal {
  const base = price.overridePrice ?? price.basePrice;
  const kind = item.markupKind ?? store.markupKind;
  const value = item.markupKind ? item.markupValue : store.markupValue;
  if (!kind || !value) return base.toDecimalPlaces(2);
  return (kind === "AMOUNT" ? base.plus(value) : base.times(value.dividedBy(100).plus(1))).toDecimalPlaces(2);
}
