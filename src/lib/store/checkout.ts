import "server-only";
import { Prisma, type Business, type Store } from "@prisma/client";
import type { BusinessDb } from "@/lib/db";
import { deliveryNote, isValidEmail, sendEmail } from "@/lib/email/mailer";
import { orderConfirmationEmail, staffAlertEmail } from "@/lib/email/templates";
import { customerLink } from "@/lib/orders/customer-flow";
import { nextOrderNumber, orderRef } from "@/lib/orders/numbers";
import { balances, refreshPaidTotal } from "@/lib/orders/payments";
import { repriceOrder } from "@/lib/orders/pricing";
import { logEvent, newToken, OrderError } from "@/lib/orders/service";
import { createCheckoutSession, PaymentError, retrieveCheckoutSession, type StripeKeys, stripeKeys } from "@/lib/payments/stripe";
import { createProductionJobs } from "@/lib/production/jobs";
import { cartTotals, type CartWithItems, findCartById, giftProblem, normalizeCode, promoProblem } from "./cart";
import type { RequestStore } from "./resolve";

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const cents = (d: Prisma.Decimal) => d.times(100).toDecimalPlaces(0).toNumber();

export type CheckoutDetails = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  deliveryMethodId: string | null;
  ship: { name: string | null; line1: string | null; line2: string | null; city: string | null; region: string | null; postalCode: string | null; country: string };
  note: string | null;
};

/** Save the shopper's contact, delivery and address on the cart. */
export async function saveCheckoutDetails(rs: RequestStore, cart: CartWithItems, d: CheckoutDetails) {
  if (!isValidEmail(d.email)) throw new OrderError("Enter a valid email address");
  if (!d.firstName.trim()) throw new OrderError("Enter your name");
  await rs.db.cart.update({
    where: { id: cart.id },
    data: {
      email: d.email.trim().toLowerCase(),
      firstName: d.firstName.trim().slice(0, 80),
      lastName: d.lastName.trim().slice(0, 80),
      phone: d.phone,
      deliveryMethodId: d.deliveryMethodId,
      shipName: d.ship.name,
      shipLine1: d.ship.line1,
      shipLine2: d.ship.line2,
      shipCity: d.ship.city,
      shipRegion: d.ship.region?.toUpperCase() ?? null,
      shipPostalCode: d.ship.postalCode,
      shipCountry: (d.ship.country || "US").toUpperCase(),
      note: d.note?.slice(0, 2000) ?? null,
      status: "OPEN",
      checkoutSessionId: null,
      amountDue: null,
    },
  });
}

export async function applyCode(rs: RequestStore, cart: CartWithItems, raw: string): Promise<string> {
  const code = normalizeCode(raw);
  if (!code) throw new OrderError("Enter a code");
  const reset = { status: "OPEN" as const, checkoutSessionId: null, amountDue: null };
  const promo = await rs.db.promoCode.findUnique({ where: { businessId_code: { businessId: rs.business.id, code } }, include: { stores: true } });
  if (promo) {
    const t = await cartTotals(rs.db, rs, cart);
    const problem = promoProblem(promo, t.merchandise, rs.store.id);
    if (problem) throw new OrderError(problem);
    await rs.db.cart.update({ where: { id: cart.id }, data: { promoCodeId: promo.id, ...reset } });
    return `Code ${code} applied`;
  }
  const gift = await rs.db.giftCode.findUnique({ where: { businessId_code: { businessId: rs.business.id, code } }, include: { stores: true } });
  if (gift) {
    const problem = giftProblem(gift, rs.store.id);
    if (problem) throw new OrderError(problem);
    await rs.db.cart.update({ where: { id: cart.id }, data: { giftCodeId: gift.id, ...reset } });
    return `Gift code applied: $${gift.balance.toFixed(2)} available`;
  }
  throw new OrderError("We don't recognise that code");
}

export async function removeCode(rs: RequestStore, cart: CartWithItems, which: "promo" | "gift") {
  await rs.db.cart.update({
    where: { id: cart.id },
    data: { ...(which === "promo" ? { promoCodeId: null } : { giftCodeId: null }), status: "OPEN", checkoutSessionId: null, amountDue: null },
  });
}

/** What has to be filled in before paying. */
export function checkoutProblem(cart: CartWithItems, totals: Awaited<ReturnType<typeof cartTotals>>): string | null {
  if (totals.count === 0) return "Your cart is empty";
  if (totals.unavailable.length) return `${totals.unavailable[0].name} is no longer available; remove it to continue`;
  if (!cart.email || !cart.firstName) return "Enter your contact details";
  if (totals.methods.length && !totals.method) return "Choose a delivery method";
  if (totals.method?.kind === "SHIP" && !(cart.shipLine1 && cart.shipCity && cart.shipRegion && cart.shipPostalCode)) return "Enter the shipping address";
  if (totals.promoError) return totals.promoError;
  if (totals.giftError) return totals.giftError;
  return null;
}

export type StartResult = { kind: "redirect"; url: string } | { kind: "placed"; orderToken: string } | { kind: "test"; url: string };

/**
 * Send the shopper to pay. Fully covered by a gift code: place the order now.
 * No Stripe keys outside production: a test payment page instead.
 */
export async function startCheckout(rs: RequestStore, cart: CartWithItems, origin: string): Promise<StartResult> {
  const totals = await cartTotals(rs.db, rs, cart);
  const problem = checkoutProblem(cart, totals);
  if (problem) throw new OrderError(problem);
  if (totals.amountDue.lte(0)) {
    const order = await placeOrderFromCart(rs.db, cart.id, null, origin);
    return { kind: "placed", orderToken: order.publicToken! };
  }
  const keys = stripeKeys(rs.business);
  if (!keys) {
    if (process.env.NODE_ENV === "production") throw new OrderError("Online payment isn't set up for this store yet. Please contact us to order.");
    await rs.db.cart.update({ where: { id: cart.id }, data: { status: "CHECKOUT", amountDue: totals.amountDue.toFixed(2) } });
    return { kind: "test", url: "/checkout/test-payment" };
  }
  const session = await createCheckoutSession(keys, {
    amountCents: cents(totals.amountDue),
    currency: rs.business.currency,
    description: `${rs.store.name} order`,
    email: cart.email,
    successUrl: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/checkout`,
    metadata: { kind: "cart", cartId: cart.id, ref: cart.id },
    // Same cart, same amount, same moment of editing → same session.
    idempotencyKey: `cart-${cart.id}-${cents(totals.amountDue)}-${cart.updatedAt.getTime()}`,
  }).catch((e) => {
    if (e instanceof PaymentError) throw new OrderError(`The payment page couldn't be opened: ${e.message}`);
    throw e;
  });
  await rs.db.cart.update({ where: { id: cart.id }, data: { status: "CHECKOUT", amountDue: totals.amountDue.toFixed(2), checkoutSessionId: session.id } });
  return { kind: "redirect", url: session.url };
}

/** Place the order without paying online, when the store allows it. */
export async function payLater(rs: RequestStore, cart: CartWithItems, origin: string) {
  if (!rs.settings.allowPayLater) throw new OrderError("This store needs payment at checkout");
  const totals = await cartTotals(rs.db, rs, cart);
  const problem = checkoutProblem(cart, totals);
  if (problem) throw new OrderError(problem);
  return placeOrderFromCart(rs.db, cart.id, null, origin);
}

/**
 * Turn a cart into an order in the CRM: customer found by email (or created),
 * lines at the store's prices, promo discount, gift code and online payment
 * recorded, production jobs created, confirmation emails sent. Safe to call
 * twice for the same cart (webhook and success page race): the second call
 * returns the order the first one made.
 */
export async function placeOrderFromCart(
  db: BusinessDb,
  cartId: string,
  payment: { amount: Prisma.Decimal; reference: string } | null,
  origin: string,
) {
  const businessId = db.$businessId;
  const business = await db.business.findUniqueOrThrow({ where: { id: businessId } });
  const claimed = await db.cart.updateMany({ where: { id: cartId, status: { not: "COMPLETED" } }, data: { status: "COMPLETED" } });
  if (claimed.count === 0) {
    const done = await db.cart.findUniqueOrThrow({ where: { id: cartId }, include: { order: true } });
    if (!done.order) throw new OrderError("This checkout is being completed; refresh in a moment");
    return done.order;
  }
  try {
    return await buildOrder(db, business, cartId, payment, origin);
  } catch (e) {
    // Leave the cart usable if the order couldn't be made.
    await db.cart.update({ where: { id: cartId }, data: { status: "CHECKOUT" } });
    throw e;
  }
}

async function buildOrder(db: BusinessDb, business: Business, cartId: string, payment: { amount: Prisma.Decimal; reference: string } | null, origin: string) {
  const businessId = business.id;
  const cart = await db.cart.findUniqueOrThrow({ where: { id: cartId }, include: { store: true } });
  const full = (await findCartById(db, cartId))!;
  const totals = await cartTotals(db, { business, store: cart.store }, full);
  if (totals.count === 0) throw new OrderError("The cart is empty");

  const order = await db.$transaction(async (tx) => {
    const email = cart.email!.toLowerCase();
    const customer =
      (cart.customerId && (await tx.customer.findUnique({ where: { id: cart.customerId } }))) ||
      (await tx.customer.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, orderBy: [{ passwordHash: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }] })) ||
      (await tx.customer.create({ data: { businessId, firstName: cart.firstName ?? "Customer", lastName: cart.lastName ?? "", email, phone: cart.phone } }));
    if (!customer.phone && cart.phone) await tx.customer.update({ where: { id: customer.id }, data: { phone: cart.phone } });
    const status = await tx.orderStatus.findFirst({ where: { type: "ORDER", isDefault: true } });
    if (!status) throw new OrderError("No default order status is set up");
    const shopperName = [cart.firstName, cart.lastName].filter(Boolean).join(" ");
    const pickup = totals.method && totals.method.kind !== "SHIP";
    const o = await tx.order.create({
      data: {
        businessId,
        type: "ORDER",
        number: await nextOrderNumber(tx, businessId, "ORDER"),
        source: "STOREFRONT",
        storeId: cart.storeId,
        placedAt: new Date(),
        customerId: customer.id,
        companyId: customer.companyId,
        statusId: status.id,
        customerNotes: cart.note,
        deliveryMethodId: totals.method?.id ?? null,
        shipping: totals.shipping.toFixed(2),
        discount: totals.discount.toFixed(2),
        promoCodeId: totals.discount.gt(0) || (cart.promoCodeId && !totals.promoError) ? cart.promoCodeId : null,
        shipName: pickup ? null : (cart.shipName ?? shopperName),
        shipLine1: pickup ? null : cart.shipLine1,
        shipLine2: pickup ? null : cart.shipLine2,
        shipCity: pickup ? null : cart.shipCity,
        shipRegion: pickup ? business.region : cart.shipRegion,
        shipPostalCode: pickup ? business.postalCode : cart.shipPostalCode,
        shipCountry: pickup ? business.country : cart.shipCountry,
        // Store items are finished designs, so the artwork counts as approved.
        approvedAt: new Date(),
        approvedByName: shopperName,
        publicToken: newToken(),
      },
    });
    // One line per item, with its sizes, at the price the shopper saw.
    const byItem = new Map<string, typeof totals.lines>();
    for (const l of totals.lines.filter((l) => l.available)) byItem.set(l.storeItemId, [...(byItem.get(l.storeItemId) ?? []), l]);
    let sortOrder = 0;
    for (const [storeItemId, ls] of byItem) {
      const item = full.items.find((i) => i.storeItemId === storeItemId)!.storeItem;
      await tx.orderLine.create({
        data: {
          businessId,
          orderId: o.id,
          designId: item.designId,
          storeItemId,
          fixedPrice: true,
          notes: item.name,
          sortOrder: sortOrder++,
          // One row per size at the item's price; names and numbers (and what they added) go on the roster.
          sizes: {
            create: [...new Set(ls.map((l) => l.sizeId))].map((sizeId) => {
              const same = ls.filter((l) => l.sizeId === sizeId);
              const qty = same.reduce((n, l) => n + l.qty, 0);
              return { sizeId, qty, unitPrice: same[0].basePrice.toFixed(2), total: same[0].basePrice.times(qty).toFixed(2) };
            }),
          },
          names: {
            create: ls
              .filter((l) => l.personalName || l.personalNumber)
              .map((l, i) => ({ sizeId: l.sizeId, name: l.personalName, number: l.personalNumber, qty: l.qty, charge: l.charge.toFixed(2), sortOrder: i })),
          },
        },
      });
    }
    if (o.promoCodeId) await tx.promoCode.update({ where: { id: o.promoCodeId }, data: { usedCount: { increment: 1 } } });
    if (cart.giftCodeId && totals.gift.gt(0)) {
      const spent = await tx.giftCode.updateMany({ where: { id: cart.giftCodeId, balance: { gte: totals.gift } }, data: { balance: { decrement: totals.gift } } });
      if (spent.count === 0) throw new OrderError("The gift code's balance changed; please try again");
      const gift = await tx.giftCode.findUniqueOrThrow({ where: { id: cart.giftCodeId } });
      await tx.giftCodeUse.create({ data: { businessId, giftCodeId: gift.id, orderId: o.id, amount: totals.gift.toFixed(2) } });
      await tx.payment.create({ data: { businessId, orderId: o.id, amount: totals.gift.toFixed(2), method: "GIFT_CARD", reference: gift.code } });
    }
    if (payment) {
      await tx.payment.create({ data: { businessId, orderId: o.id, amount: payment.amount.toFixed(2), method: "ONLINE", reference: payment.reference, note: "Paid at checkout" } });
    }
    await refreshPaidTotal(tx, o.id);
    await tx.cart.update({ where: { id: cartId }, data: { orderId: o.id, customerId: customer.id } });
    await logEvent(tx, businessId, o.id, "CREATED", `Order ${orderRef(o)} placed online at ${cart.store.name} by ${shopperName} (${email})`, null);
    return o;
  });

  await repriceOrder(db, order.id);
  const placed = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { customer: true, lines: { include: { sizes: { include: { size: true } } } } } });
  await createProductionJobs(db, order.id, null).catch((e) => {
    if (!(e instanceof OrderError)) throw e;
  });
  await sendOrderEmails(db, business, cart.store, placed, totals.lines.map((l) => `${l.qty} × ${l.name} (${l.detail})`), totals.method?.name ?? null, origin);
  return placed;
}

async function sendOrderEmails(
  db: BusinessDb,
  business: Business,
  store: Store,
  order: { id: string; type: "QUOTE" | "ORDER"; number: number; total: Prisma.Decimal; paidTotal: Prisma.Decimal; depositRequired: Prisma.Decimal; publicToken: string | null; customer: { firstName: string; lastName: string; email: string | null } },
  items: string[],
  delivery: string | null,
  origin: string,
) {
  const brand = { name: business.name, email: business.email, phone: business.phone };
  const ref = orderRef(order);
  if (isValidEmail(order.customer.email)) {
    const content = orderConfirmationEmail({
      brand,
      customerName: order.customer.firstName,
      ref,
      items,
      total: order.total.toFixed(2),
      paid: order.paidTotal.toFixed(2),
      balance: balances(order).balance.toFixed(2),
      delivery,
      url: customerLink(origin, order.publicToken!),
    });
    const r = await sendEmail(db, { ...content, to: order.customer.email, fromName: business.name, replyTo: business.email, orderId: order.id });
    await logEvent(db, business.id, order.id, "EMAIL", `Order confirmation emailed to ${order.customer.email}${deliveryNote(r.status)}`, null);
  }
  if (isValidEmail(business.email)) {
    const heading = `New online order ${ref} from ${order.customer.firstName} ${order.customer.lastName}`.trim();
    const content = staffAlertEmail({ brand, heading, lines: [`${store.name}: $${order.total.toFixed(2)}`, ...items], url: `${origin}/admin/orders/${order.id}` });
    await sendEmail(db, { ...content, to: business.email, fromName: business.name, orderId: order.id });
  }
}

/** Finish a Stripe Checkout session (from the webhook or the success page). */
export async function completeCheckoutSession(db: BusinessDb, keys: StripeKeys, sessionId: string, origin: string) {
  const session = await retrieveCheckoutSession(keys, sessionId);
  if (session.payment_status !== "paid") return null;
  const amount = D(session.amount_total).dividedBy(100);
  const reference = session.payment_intent ?? session.id;
  if (session.metadata.kind === "cart") {
    const cart = await db.cart.findFirst({ where: { id: session.metadata.cartId, checkoutSessionId: session.id } });
    if (!cart) return null;
    return placeOrderFromCart(db, cart.id, { amount, reference }, origin);
  }
  if (session.metadata.kind === "order") return recordOrderPayment(db, session.metadata.orderId, amount, reference);
  return null;
}

/** An online payment toward an existing order's balance, recorded once. */
async function recordOrderPayment(db: BusinessDb, orderId: string, amount: Prisma.Decimal, reference: string) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (await tx.payment.findFirst({ where: { orderId, method: "ONLINE", reference } })) return order;
    await tx.payment.create({ data: { businessId: tx.$businessId, orderId, amount: amount.toFixed(2), method: "ONLINE", reference, note: "Paid online" } });
    await refreshPaidTotal(tx, orderId);
    await logEvent(tx, tx.$businessId, orderId, "PAYMENT", `Customer paid $${amount.toFixed(2)} online`, null);
    return tx.order.findUniqueOrThrow({ where: { id: orderId } });
  });
}

/** Pay toward an order from the customer's order page: the deposit due, or the balance. */
export async function startOrderPayment(db: BusinessDb, business: Business, token: string, origin: string): Promise<string> {
  const keys = stripeKeys(business);
  if (!keys) throw new OrderError("Online payment isn't set up yet. Please use the payment instructions on this page.");
  const order = await db.order.findFirst({ where: { publicToken: token, type: "ORDER" } });
  if (!order) throw new OrderError("This link isn't valid");
  const { balance, depositDue } = balances(order);
  const amount = depositDue.gt(0) ? depositDue : balance;
  if (amount.lte(0)) throw new OrderError("Nothing is owing on this order");
  const session = await createCheckoutSession(keys, {
    amountCents: cents(amount),
    currency: business.currency,
    description: `${depositDue.gt(0) ? "Deposit for" : "Payment for"} order ${orderRef(order)}`,
    email: null,
    successUrl: `${origin}/c/${token}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/c/${token}`,
    metadata: { kind: "order", orderId: order.id, ref: orderRef(order) },
    idempotencyKey: `order-${order.id}-${cents(amount)}-${order.updatedAt.getTime()}`,
  }).catch((e) => {
    if (e instanceof PaymentError) throw new OrderError(`The payment page couldn't be opened: ${e.message}`);
    throw e;
  });
  return session.url;
}

