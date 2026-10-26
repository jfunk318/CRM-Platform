import "server-only";
import { isValidEmail, sendEmail } from "@/lib/email/mailer";
import { staffAlertEmail } from "@/lib/email/templates";
import { createLead } from "@/lib/crm/leads";
import { addOrderFiles } from "@/lib/files/order-files";
import { nextOrderNumber, orderRef } from "@/lib/orders/numbers";
import { addLine, logEvent, OrderError } from "@/lib/orders/service";
import type { RequestStore } from "./resolve";

export type QuoteRequest = {
  name: string;
  email: string;
  phone: string | null;
  organization: string | null;
  details: string;
  neededBy: Date | null;
  product: { productId: string; colorId: string; quantities: Record<string, number> } | null;
  files: File[];
  origin: string;
};

/**
 * A shopper asks for a quote: it lands in the CRM as a draft quote for the
 * customer (found by email, or new), with the product and sizes they picked,
 * their notes and files, and the shop gets an email.
 */
export async function createQuoteRequest(rs: RequestStore, r: QuoteRequest) {
  const { db, business } = rs;
  const email = r.email.trim().toLowerCase();
  if (!isValidEmail(email)) throw new OrderError("Enter a valid email address");
  const [firstName, ...rest] = r.name.trim().split(/\s+/);
  if (!firstName) throw new OrderError("Enter your name");
  if (!r.details.trim() && !r.product) throw new OrderError("Tell us what you'd like");

  const existing = await db.customer.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, orderBy: { updatedAt: "desc" }, include: { _count: { select: { orders: { where: { type: "ORDER" } } } } } });
  const customer = existing ?? (await db.customer.create({ data: { businessId: business.id, firstName: firstName.slice(0, 80), lastName: rest.join(" ").slice(0, 80), email, phone: r.phone } }));
  // Someone who has never ordered is a new prospect: they're also a lead.
  const newcomer = !existing || existing._count.orders === 0;
  const status = await db.orderStatus.findFirst({ where: { type: "QUOTE", isDefault: true } });
  if (!status) throw new OrderError("Quotes aren't set up yet. Please email us instead.");
  const productName = r.product ? (await db.product.findUnique({ where: { id: r.product.productId } }))?.name : null;

  const quote = await db.$transaction(async (tx) =>
    tx.order.create({
      data: {
        businessId: business.id,
        type: "QUOTE",
        number: await nextOrderNumber(tx, business.id, "QUOTE"),
        source: "QUOTE_REQUEST",
        storeId: rs.store.id,
        title: `Quote request${productName ? `: ${productName}` : ""}${r.organization ? ` (${r.organization})` : ""}`.slice(0, 200),
        customerId: customer.id,
        companyId: customer.companyId,
        statusId: status.id,
        dueDate: r.neededBy,
      },
    }),
  );
  await logEvent(db, business.id, quote.id, "CREATED", `Quote ${orderRef(quote)} requested online by ${r.name.trim()} (${email}${r.phone ? `, ${r.phone}` : ""})`, null);
  await logEvent(db, business.id, quote.id, "CUSTOMER", `Request: ${r.details.trim().slice(0, 4000) || "(no details)"}${r.organization ? `\nOrganization: ${r.organization}` : ""}`, null);
  if (r.product) {
    try {
      await addLine(db, quote.id, { productId: r.product.productId, colorId: r.product.colorId, quantities: r.product.quantities, decorations: [], notes: "As requested; add decoration" }, null);
    } catch (e) {
      // Keep the request even if the sizes didn't make a valid line.
      if (!(e instanceof OrderError)) throw e;
      await logEvent(db, business.id, quote.id, "NOTE", `Couldn't add the requested item: ${e.message}`, null);
    }
  }
  if (r.files.length) await addOrderFiles(db, quote.id, r.files, "CUSTOMER", null);
  if (newcomer) {
    await createLead(
      db,
      {
        firstName: customer.firstName,
        lastName: customer.lastName,
        organization: r.organization,
        title: null,
        email,
        phone: r.phone,
        source: "Website quote request",
        interest: [productName, r.details.trim()].filter(Boolean).join("\n") || null,
        estimatedValue: null,
        ownerId: null,
      },
      null,
      { customerId: customer.id, quoteId: quote.id },
    );
  }

  if (isValidEmail(business.email)) {
    const content = staffAlertEmail({
      brand: { name: business.name, email: business.email, phone: business.phone },
      heading: `New quote request ${orderRef(quote)} from ${r.name.trim()}`,
      lines: [r.details.trim() || "(no details)", ...(productName ? [`Product: ${productName}`] : []), ...(r.files.length ? [`${r.files.length} file(s) attached`] : [])],
      url: `${r.origin}/admin/orders/${quote.id}`,
    });
    await sendEmail(db, { ...content, to: business.email, fromName: business.name, replyTo: email, orderId: quote.id });
  }
  return quote;
}
