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

export type StoreStatus = { state: "open" | "scheduled" | "closed"; label: string };

const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Open, not yet open, or closed, from the store's switch and dates. */
export function storeStatus(store: Pick<Store, "active" | "opensAt" | "closesAt">, now = new Date()): StoreStatus {
  if (!store.active) return { state: "closed", label: "Closed" };
  if (store.opensAt && store.opensAt > now) return { state: "scheduled", label: `Opens ${day(store.opensAt)}` };
  if (store.closesAt && store.closesAt <= now) return { state: "closed", label: `Closed ${day(store.closesAt)}` };
  return { state: "open", label: store.closesAt ? `Open · closes ${day(store.closesAt)}` : "Open" };
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
type Markup = { markupKind: MarkupKind | null; markupValue: Prisma.Decimal | null };

/** The markup that applies: the item's, else the store's, else its group's. */
export function effectiveMarkup(item: Markup, store: Markup & { group?: Markup | null }): Markup {
  if (item.markupKind) return item;
  if (store.markupKind) return store;
  return store.group?.markupKind ? store.group : { markupKind: null, markupValue: null };
}

export function itemPrice(
  price: { basePrice: Prisma.Decimal; overridePrice: Prisma.Decimal | null },
  item: Markup,
  store: Markup & { group?: Markup | null },
): Prisma.Decimal {
  const base = price.overridePrice ?? price.basePrice;
  const { markupKind: kind, markupValue: value } = effectiveMarkup(item, store);
  if (!kind || !value) return base.toDecimalPlaces(2);
  return (kind === "AMOUNT" ? base.plus(value) : base.times(value.dividedBy(100).plus(1))).toDecimalPlaces(2);
}
