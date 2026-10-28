import "server-only";
import { Prisma, type Customer, type Store, type StoreRequestStatus } from "@prisma/client";
import { backOfficeOrigin } from "@/lib/business";
import { decryptSecret } from "@/lib/crypto";
import type { BusinessDb } from "@/lib/db";
import { isValidEmail, sendEmail } from "@/lib/email/mailer";
import { staffAlertEmail, storeRequestReplyEmail } from "@/lib/email/templates";
import { createOrder, logEvent, OrderError } from "@/lib/orders/service";
import { codeWorksIn } from "./cart";
import { commissionSummary } from "./commissions";
import { emitAutomation } from "@/lib/automation/events";
import { visitStats } from "./visits";

/** Sections staff can show in a store's owner portal. */
export const PORTAL_SECTIONS = {
  sales: "Sales",
  orders: "Orders",
  codes: "Codes",
  commission: "Commission",
  requests: "Requests",
} as const;
export type PortalSection = keyof typeof PORTAL_SECTIONS;
export const isPortalSection = (s: string): s is PortalSection => s in PORTAL_SECTIONS;

export const REQUEST_STATUS_LABELS = { NEW: "New", IN_PROGRESS: "In progress", DONE: "Done", DECLINED: "Declined" } as const;

/**
 * Whether a signed-in shopper can open the store's owner portal: the store's
 * customer, or a contact staff added with portal access.
 */
export async function portalRole(db: BusinessDb, store: Store, customer: Customer | null): Promise<"owner" | "contact" | null> {
  if (!customer || store.kind !== "AFFILIATE") return null;
  if (store.customerId === customer.id) return "owner";
  // Contacts are matched by their account's email too, in case they signed in as a different customer record.
  const contact = await db.storeContact.findFirst({
    where: { storeId: store.id, canManage: true, OR: [{ customerId: customer.id }, ...(customer.email ? [{ customer: { email: { equals: customer.email, mode: "insensitive" as const } } }] : [])] },
  });
  return contact ? "contact" : null;
}

/** Everything the portal shows, limited to the sections the store has turned on. */
export async function portalData(db: BusinessDb, store: Store) {
  const on = (s: PortalSection) => store.portalSections.includes(s);
  const shopperOrders = { storeId: store.id, type: "ORDER" as const, source: "STOREFRONT" as const };
  const [sales, pieces, orders, codes, commission, requests, contacts] = await Promise.all([
    on("sales") ? db.order.aggregate({ where: { ...shopperOrders, NOT: { status: { isClosed: true, role: null } } }, _sum: { merchandise: true, discount: true }, _count: true }) : null,
    on("sales") ? db.orderLineSize.aggregate({ where: { line: { order: { ...shopperOrders, NOT: { status: { isClosed: true, role: null } } } } }, _sum: { qty: true } }) : null,
    on("orders")
      ? db.order.findMany({
          where: shopperOrders,
          orderBy: { placedAt: "desc" },
          take: 200,
          select: {
            id: true,
            type: true,
            number: true,
            placedAt: true,
            total: true,
            status: { select: { name: true } },
            customer: { select: { firstName: true, lastName: true } },
            lines: { select: { notes: true, sizes: { select: { qty: true, size: { select: { code: true } } } }, names: { select: { name: true, number: true } } } },
          },
        })
      : null,
    on("codes") ? codeUsage(db, store.id) : null,
    on("commission") ? commissionSummary(db, store.id) : null,
    on("requests") ? db.storeRequest.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "desc" }, include: { customer: { select: { firstName: true, lastName: true } } } }) : null,
    db.storeContact.findMany({ where: { storeId: store.id }, include: { customer: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const visits = on("sales") ? (await visitStats(db, [store.id])).get(store.id)! : null;
  return {
    sales: sales && { orders: sales._count, sold: (sales._sum.merchandise ?? new Prisma.Decimal(0)).minus(sales._sum.discount ?? 0), pieces: pieces?._sum.qty ?? 0, visits: visits!.visits },
    orders,
    codes,
    commission,
    requests,
    contacts,
  };
}

/** Promo and gift codes that work in the store, with how often they were used there. */
async function codeUsage(db: BusinessDb, storeId: string) {
  const [promos, gifts, promoUses, giftUses] = await Promise.all([
    db.promoCode.findMany({ where: { active: true }, include: { stores: true }, orderBy: { code: "asc" } }),
    db.giftCode.findMany({ where: { active: true }, include: { stores: true }, orderBy: { code: "asc" } }),
    db.order.groupBy({ by: ["promoCodeId"], where: { storeId, promoCodeId: { not: null } }, _count: true, _sum: { discount: true } }),
    db.giftCodeUse.groupBy({ by: ["giftCodeId"], where: { order: { storeId } }, _count: true, _sum: { amount: true } }),
  ]);
  return {
    promos: promos
      .filter((p) => codeWorksIn(p, storeId))
      .map((p) => ({ code: p.code, kind: p.kind, value: p.value, endsAt: p.endsAt, uses: promoUses.find((u) => u.promoCodeId === p.id)?._count ?? 0, saved: promoUses.find((u) => u.promoCodeId === p.id)?._sum.discount ?? null })),
    gifts: gifts
      .filter((g) => codeWorksIn(g, storeId))
      .map((g) => ({ code: g.code, balance: g.balance, uses: giftUses.find((u) => u.giftCodeId === g.id)?._count ?? 0, spent: giftUses.find((u) => u.giftCodeId === g.id)?._sum.amount ?? null })),
  };
}

/**
 * A store owner's request. Staff are emailed and (if set up) told in Slack;
 * stores that want it get a draft quote for the requester right away.
 */
export async function submitStoreRequest(db: BusinessDb, store: Store, customer: Customer, input: { subject: string; body: string }, origin: string) {
  const subject = input.subject.trim().slice(0, 150);
  const body = input.body.trim().slice(0, 5000);
  if (!subject) throw new OrderError("Add a subject");
  if (!body) throw new OrderError("Say what you need");
  const recent = await db.storeRequest.count({ where: { storeId: store.id, customerId: customer.id, createdAt: { gt: new Date(Date.now() - 3_600_000) } } });
  if (recent >= 10) throw new OrderError("That's a lot of requests in an hour; please wait a little before sending more");
  const request = await db.$transaction(async (tx) => {
    const r = await tx.storeRequest.create({ data: { businessId: db.$businessId, storeId: store.id, customerId: customer.id, subject, body } });
    await emitAutomation(tx, { trigger: "STORE_REQUEST", requestId: r.id });
    return r;
  });
  if (store.requestQuotes) await quoteFromRequest(db, request.id, null);

  const business = await db.business.findUniqueOrThrow({ where: { id: db.$businessId } });
  const who = `${customer.firstName} ${customer.lastName}`.trim() || customer.email || "A store owner";
  const url = `${backOfficeOrigin(origin, store.slug)}/admin/stores/${store.id}/requests`;
  if (isValidEmail(business.email)) {
    const content = staffAlertEmail({ brand: { name: business.name, email: business.email, phone: business.phone }, heading: `Request from ${store.name}: ${subject}`, lines: [`From ${who}`, body], url });
    await sendEmail(db, { ...content, to: business.email, fromName: business.name, replyTo: customer.email ?? undefined });
  }
  await postToSlack(business.slackWebhookEnc, `*Request from ${store.name}* (${who}): ${subject}\n${body.slice(0, 500)}\n<${url}|Open in the back office>`);
  return request;
}

/** Post to the business's Slack webhook; Slack being down never fails the request. */
export async function postToSlack(webhookEnc: string | null, text: string) {
  if (!webhookEnc) return false;
  try {
    const res = await fetch(decryptSecret(webhookEnc), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(10_000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** A draft quote for the person who made the request, linked to it. */
export async function quoteFromRequest(db: BusinessDb, requestId: string, staffId: string | null): Promise<string> {
  const request = await db.storeRequest.findUniqueOrThrow({ where: { id: requestId }, include: { store: true } });
  if (request.quoteId) return request.quoteId;
  const quoteId = await createOrder(db, { type: "QUOTE", customerId: request.customerId, staffId, title: `${request.store.name}: ${request.subject}`.slice(0, 150) });
  await db.order.update({ where: { id: quoteId }, data: { storeId: request.storeId } });
  await db.storeRequest.update({ where: { id: request.id }, data: { quoteId, status: request.status === "NEW" ? "IN_PROGRESS" : request.status, seenAt: request.seenAt ?? new Date() } });
  await logEvent(db, db.$businessId, quoteId, "NOTE", `From a store request:\n${request.subject}\n\n${request.body}`, staffId);
  return quoteId;
}

/**
 * Staff move a request along and (optionally) answer it. A new or changed
 * reply is emailed to whoever asked, with a link to the portal.
 */
export async function updateStoreRequest(db: BusinessDb, requestId: string, o: { status: StoreRequestStatus; reply: string | null }, storeUrl: string) {
  const request = await db.storeRequest.findUniqueOrThrow({ where: { id: requestId }, include: { store: true, customer: true } });
  const reply = o.reply?.trim().slice(0, 5000) || null;
  await db.storeRequest.update({ where: { id: request.id }, data: { status: o.status, reply, seenAt: request.seenAt ?? new Date() } });
  if (!reply || reply === request.reply || !isValidEmail(request.customer.email)) return false;
  const business = await db.business.findUniqueOrThrow({ where: { id: db.$businessId } });
  const content = storeRequestReplyEmail({
    brand: { name: business.name, email: business.email, phone: business.phone },
    storeName: request.store.name,
    subject: request.subject,
    status: REQUEST_STATUS_LABELS[o.status],
    reply,
    url: `${storeUrl}/owner?tab=requests`,
  });
  await sendEmail(db, { ...content, to: request.customer.email!, fromName: business.name, replyTo: business.email });
  return true;
}

/** New (unanswered) requests per store, for the flags in the back office. */
export async function newRequestCounts(db: BusinessDb): Promise<Map<string, number>> {
  const rows = await db.storeRequest.groupBy({ by: ["storeId"], where: { status: "NEW" }, _count: true });
  return new Map(rows.map((r) => [r.storeId, r._count]));
}
