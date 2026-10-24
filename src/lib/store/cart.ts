import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { type Business, type GiftCode, Prisma, type PromoCode, type Store } from "@prisma/client";
import type { BusinessDb, BusinessTx } from "@/lib/db";
import { OrderError } from "@/lib/orders/service";
import { type LineItemPrice, priceOrder } from "@/lib/pricing";
import { loadTaxRates } from "@/lib/pricing/load";
import { checkPersonalization, offersPersonalization, PersonalizationError, personalizationLabel } from "./personalization";
import { itemPrice, offeredMethods } from "./settings";
import type { RequestStore } from "./resolve";

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const ZERO = D(0);
export const CART_COOKIE = "cart";
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

// ─── Codes ──────────────────────────────────────────────────────────────

export const normalizeCode = (raw: string) => raw.trim().toUpperCase().replace(/\s+/g, "");

/** Codes limited to some stores only work in those stores. */
export const codeWorksIn = (c: { allStores: boolean; stores: { storeId: string }[] }, storeId: string) => c.allStores || c.stores.some((s) => s.storeId === storeId);

/** Why a promo code can't be used right now, or null if it can. */
export function promoProblem(p: PromoCode & { stores: { storeId: string }[] }, merchandise: Prisma.Decimal, storeId: string, now = new Date()): string | null {
  if (!p.active) return "That code isn't active";
  if (!codeWorksIn(p, storeId)) return "That code isn't valid in this store";
  if (p.startsAt && p.startsAt > now) return "That code isn't active yet";
  if (p.endsAt && p.endsAt < now) return "That code has expired";
  if (p.maxUses !== null && p.usedCount >= p.maxUses) return "That code has been used up";
  if (p.minSubtotal && merchandise.lt(p.minSubtotal)) return `That code needs at least $${p.minSubtotal.toFixed(2)} in your cart`;
  return null;
}

export function promoDiscount(p: PromoCode, merchandise: Prisma.Decimal): Prisma.Decimal {
  if (p.kind === "PERCENT") return merchandise.times(Prisma.Decimal.min(p.value, 100)).dividedBy(100).toDecimalPlaces(2);
  if (p.kind === "AMOUNT") return Prisma.Decimal.min(p.value, merchandise);
  return ZERO;
}

export function giftProblem(g: GiftCode & { stores: { storeId: string }[] }, storeId: string, now = new Date()): string | null {
  if (!g.active) return "That gift code isn't active";
  if (!codeWorksIn(g, storeId)) return "That gift code isn't valid in this store";
  if (g.expiresAt && g.expiresAt < now) return "That gift code has expired";
  if (g.balance.lte(0)) return "That gift code has no balance left";
  return null;
}

// ─── The cart ───────────────────────────────────────────────────────────

const cartInclude = {
  items: {
    orderBy: { id: "asc" },
    include: {
      storeItem: { include: { prices: true, image: true, design: { include: { product: true, color: true } } } },
    },
  },
  promoCode: { include: { stores: true } },
  giftCode: { include: { stores: true } },
  deliveryMethod: true,
} satisfies Prisma.CartInclude;

export type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

/** The shopper's open cart for this store, if they have one. */
export async function currentCart(rs: RequestStore): Promise<CartWithItems | null> {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token) return null;
  const cart = await rs.db.cart.findUnique({ where: { tokenHash: hash(token) }, include: cartInclude });
  if (!cart || cart.storeId !== rs.store.id || cart.status === "COMPLETED") return null;
  return cart;
}

/** The shopper's cart, starting one (and its cookie) if needed. */
export async function ensureCart(rs: RequestStore): Promise<CartWithItems> {
  const existing = await currentCart(rs);
  if (existing) return existing;
  const token = randomBytes(24).toString("base64url");
  const cart = await rs.db.cart.create({ data: { businessId: rs.business.id, storeId: rs.store.id, tokenHash: hash(token) }, include: cartInclude });
  (await cookies()).set(CART_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return cart;
}

export const findCartById = (db: BusinessDb, id: string) => db.cart.findUnique({ where: { id }, include: cartInclude });

/** Add pieces of an item; quantities per size, with the name/number to print if the item offers them. */
export async function addToCart(rs: RequestStore, storeItemId: string, quantities: Record<string, number>, personal: { name?: string | null; number?: string | null } = {}) {
  const item = await rs.db.storeItem.findFirst({ where: { id: storeItemId, storeId: rs.store.id, published: true }, include: { prices: true } });
  if (!item) throw new OrderError("That item isn't available");
  const wanted = Object.entries(quantities).filter(([, q]) => q > 0);
  if (wanted.length === 0) throw new OrderError("Choose a size and quantity");
  for (const [sizeId, q] of wanted) {
    if (!item.prices.some((p) => p.sizeId === sizeId)) throw new OrderError("That size isn't available");
    if (!Number.isInteger(q) || q > 999) throw new OrderError("Quantities must be whole numbers under 1,000");
  }
  let name = "";
  let number = "";
  if (offersPersonalization(item)) {
    try {
      ({ name, number } = checkPersonalization(item, personal));
    } catch (e) {
      if (e instanceof PersonalizationError) throw new OrderError(e.message);
      throw e;
    }
  }
  const cart = await ensureCart(rs);
  if (cart.status !== "OPEN") await rs.db.cart.update({ where: { id: cart.id }, data: { status: "OPEN", checkoutSessionId: null, amountDue: null } });
  for (const [sizeId, qty] of wanted) {
    await rs.db.cartItem.upsert({
      where: { cartId_storeItemId_sizeId_name_number: { cartId: cart.id, storeItemId, sizeId, name, number } },
      create: { businessId: rs.business.id, cartId: cart.id, storeItemId, sizeId, qty, name, number },
      update: { qty: { increment: qty } },
    });
  }
}

export async function setCartQty(rs: RequestStore, cartItemId: string, qty: number) {
  const cart = await currentCart(rs);
  const line = cart?.items.find((i) => i.id === cartItemId);
  if (!cart || !line) throw new OrderError("That item is no longer in your cart");
  if (!Number.isInteger(qty) || qty < 0 || qty > 999) throw new OrderError("Quantities must be whole numbers under 1,000");
  if (qty === 0) await rs.db.cartItem.delete({ where: { id: line.id } });
  else await rs.db.cartItem.update({ where: { id: line.id }, data: { qty } });
  if (cart.status !== "OPEN") await rs.db.cart.update({ where: { id: cart.id }, data: { status: "OPEN", checkoutSessionId: null, amountDue: null } });
}

// ─── Totals ─────────────────────────────────────────────────────────────

export type CartLine = {
  id: string;
  storeItemId: string;
  sizeId: string;
  name: string;
  detail: string; // "Heather Navy · M"
  imageFileId: string | null;
  slug: string;
  qty: number;
  /** Name and number to print ("" = none) and what they add to each piece. */
  personalName: string;
  personalNumber: string;
  charge: Prisma.Decimal;
  /** The item's price for the size, before `charge`. */
  basePrice: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  total: Prisma.Decimal;
  available: boolean;
};

export type CartTotals = Awaited<ReturnType<typeof cartTotals>>;

/**
 * Everything the cart and checkout show: lines at current store prices,
 * promo discount, delivery charge, tax for the address, gift code applied
 * and what's left to pay.
 */
export async function cartTotals(db: BusinessDb | BusinessTx, rs: { business: Business; store: Store }, cart: CartWithItems) {
  const store = await db.store.findUniqueOrThrow({ where: { id: rs.store.id }, include: { deliveryMethods: true, group: true } });
  const sizes = await db.productSize.findMany({ where: { id: { in: cart.items.map((i) => i.sizeId) } } });
  const lines: CartLine[] = cart.items.map((i) => {
    const price = i.storeItem.prices.find((p) => p.sizeId === i.sizeId);
    const base = price ? itemPrice(price, i.storeItem, store) : ZERO;
    // Priced from the item's current options (they may have changed since it was added).
    const charge = (i.name && i.storeItem.nameMode !== "OFF" ? i.storeItem.namePrice : ZERO).plus(i.number && i.storeItem.numberMode !== "OFF" ? i.storeItem.numberPrice : ZERO);
    const unit = base.plus(charge);
    const available = !!price && i.storeItem.published;
    return {
      id: i.id,
      storeItemId: i.storeItemId,
      sizeId: i.sizeId,
      name: i.storeItem.name,
      detail: [i.storeItem.design.color.name, sizes.find((s) => s.id === i.sizeId)?.code ?? "?", personalizationLabel(i)].filter(Boolean).join(" · "),
      imageFileId: i.storeItem.imageFileId,
      slug: i.storeItem.slug,
      qty: i.qty,
      personalName: i.name,
      personalNumber: i.number,
      charge,
      basePrice: base,
      unitPrice: unit,
      total: available ? unit.times(i.qty) : ZERO,
      available,
    };
  });
  const merchandise = lines.reduce((t, l) => t.plus(l.total), ZERO);

  let promoError: string | null = null;
  let discount = ZERO;
  let freeShipping = false;
  if (cart.promoCode) {
    promoError = promoProblem(cart.promoCode, merchandise, store.id);
    if (!promoError) {
      discount = promoDiscount(cart.promoCode, merchandise);
      freeShipping = cart.promoCode.kind === "FREE_SHIPPING";
    }
  }

  const methods = offeredMethods(store, await db.deliveryMethod.findMany({ orderBy: { sortOrder: "asc" } }));
  const method = methods.find((m) => m.id === cart.deliveryMethodId) ?? null;
  const shipping =
    !method || freeShipping ? ZERO : method.freeOver && merchandise.gte(method.freeOver) ? ZERO : method.price;

  // Tax where the goods are handed over: the ship-to address, or the shop for pickups.
  const pickup = method && method.kind !== "SHIP";
  const where = pickup
    ? { country: rs.business.country, region: rs.business.region, postalCode: rs.business.postalCode }
    : { country: cart.shipCountry, region: cart.shipRegion, postalCode: cart.shipPostalCode };
  const taxRates = where.region ? await loadTaxRates(db, { country: where.country, region: where.region, postalCode: where.postalCode }) : [];
  const priced: LineItemPrice[] = lines.map((l) => ({
    totalQty: l.qty,
    sizes: [],
    decorations: [],
    fees: [],
    merchandiseTotal: l.total,
    feesTotal: ZERO,
    total: l.total,
    issues: [],
  }));
  const totals = priceOrder({ lines: priced, shipping: shipping.toString(), discount: discount.toString(), taxRates });
  const total = D(totals.total.toFixed(2));

  let giftError: string | null = null;
  let gift = ZERO;
  if (cart.giftCode) {
    giftError = giftProblem(cart.giftCode, store.id);
    if (!giftError) gift = Prisma.Decimal.min(cart.giftCode.balance, total);
  }

  return {
    lines,
    count: lines.reduce((n, l) => n + l.qty, 0),
    merchandise,
    discount: D(totals.discount.toFixed(2)),
    promoError,
    methods,
    method,
    shipping: D(totals.shipping.toFixed(2)),
    tax: D(totals.tax.toFixed(2)),
    total,
    gift,
    giftError,
    amountDue: total.minus(gift),
    unavailable: lines.filter((l) => !l.available),
  };
}
