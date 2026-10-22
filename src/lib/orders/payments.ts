import "server-only";
import { Prisma, type PaymentMethod } from "@prisma/client";
import type { BusinessDb, BusinessTx } from "@/lib/db";
import { deliveryNote, isValidEmail, sendEmail } from "@/lib/email/mailer";
import { invoiceEmail } from "@/lib/email/templates";
import { customerLink, ensurePublicToken } from "./customer-flow";
import { invoiceRef, nextNumber, orderRef } from "./numbers";
import { logEvent, OrderError } from "./service";

// Payments, deposits and invoices on orders.

const money = (d: Prisma.Decimal) => `$${d.toFixed(2)}`;

/** What the customer still owes, and how much of the deposit is outstanding. */
export function balances(o: { total: Prisma.Decimal; paidTotal: Prisma.Decimal; depositRequired: Prisma.Decimal }) {
  const balance = o.total.minus(o.paidTotal);
  const depositDue = Prisma.Decimal.max(new Prisma.Decimal(0), o.depositRequired.minus(o.paidTotal));
  return { balance, depositDue };
}

export async function refreshPaidTotal(tx: BusinessTx, orderId: string) {
  const sum = await tx.payment.aggregate({ where: { orderId }, _sum: { amount: true } });
  await tx.order.update({ where: { id: orderId }, data: { paidTotal: sum._sum.amount ?? 0 } });
}

/**
 * Record a payment (or a refund, as a negative amount). Refunds can't exceed
 * what's been paid.
 */
export async function recordPayment(
  db: BusinessDb,
  orderId: string,
  p: {
    amount: Prisma.Decimal;
    refund: boolean;
    method: PaymentMethod;
    reference: string | null;
    note: string | null;
    receivedAt: Date;
    staffId: string | null;
  },
) {
  if (p.amount.lte(0)) throw new OrderError("Enter an amount above zero");
  const businessId = db.$businessId;
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.type !== "ORDER") throw new OrderError("Payments are recorded on orders");
    if (p.refund && p.amount.gt(order.paidTotal)) throw new OrderError(`You can refund at most ${money(order.paidTotal)}`);
    await tx.payment.create({
      data: {
        businessId,
        orderId,
        amount: p.refund ? p.amount.negated() : p.amount,
        method: p.method,
        reference: p.reference,
        note: p.note,
        receivedAt: p.receivedAt,
        staffId: p.staffId,
      },
    });
    await refreshPaidTotal(tx, orderId);
    await logEvent(
      tx,
      businessId,
      orderId,
      "PAYMENT",
      `${p.refund ? "Refund" : "Payment"} of ${money(p.amount)} (${p.method.toLowerCase().replace("_", " ")}${p.reference ? ` ${p.reference}` : ""}) recorded`,
      p.staffId,
    );
  });
}

export async function setDeposit(db: BusinessDb, orderId: string, amount: Prisma.Decimal, staffId: string | null) {
  if (amount.lt(0)) throw new OrderError("The deposit can't be negative");
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (amount.gt(order.total)) throw new OrderError("The deposit can't be more than the total");
  await db.order.update({ where: { id: orderId }, data: { depositRequired: amount } });
  await logEvent(db, db.$businessId, orderId, "EDITED", `Deposit required set to ${money(amount)}`, staffId);
}

/** Give an order its invoice number (once) and due date. */
export async function issueInvoice(db: BusinessDb, orderId: string, o: { dueDate: Date | null; staffId: string | null }) {
  const businessId = db.$businessId;
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { lines: true } });
    if (order.type !== "ORDER") throw new OrderError("Invoices are issued for orders");
    if (order.lines.length === 0) throw new OrderError("The order has no items");
    if (order.invoiceNumber) {
      await tx.order.update({ where: { id: orderId }, data: { invoiceDueDate: o.dueDate } });
      return order.invoiceNumber;
    }
    const invoiceNumber = await nextNumber(tx, businessId, "invoice");
    await tx.order.update({ where: { id: orderId }, data: { invoiceNumber, invoicedAt: new Date(), invoiceDueDate: o.dueDate } });
    await logEvent(tx, businessId, orderId, "INVOICE", `Invoice ${invoiceRef(invoiceNumber)} issued`, o.staffId);
    return invoiceNumber;
  });
}

/** Email the invoice link to the customer, issuing the invoice first if needed. */
export async function sendInvoice(db: BusinessDb, orderId: string, o: { origin: string; staffId: string | null }) {
  const pre = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { customer: true } });
  if (!isValidEmail(pre.customer.email)) throw new OrderError("Add an email address to the customer first");
  const invoiceNumber = await issueInvoice(db, orderId, { dueDate: pre.invoiceDueDate, staffId: o.staffId });
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  const business = await db.business.findUniqueOrThrow({ where: { id: db.$businessId } });
  const token = await ensurePublicToken(db, orderId);
  const { balance } = balances(order);
  const content = invoiceEmail({
    brand: { name: business.name, email: business.email, phone: business.phone },
    customerName: pre.customer.firstName,
    invoiceRef: invoiceRef(invoiceNumber),
    orderRef: orderRef(order),
    total: order.total.toFixed(2),
    balance: balance.toFixed(2),
    dueDate: order.invoiceDueDate?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }),
    url: customerLink(o.origin, token),
  });
  const result = await sendEmail(db, { ...content, to: pre.customer.email, fromName: business.name, replyTo: business.email, orderId });
  await logEvent(db, db.$businessId, orderId, "EMAIL", `Invoice ${invoiceRef(invoiceNumber)} emailed to ${pre.customer.email}${deliveryNote(result.status)}`, o.staffId);
  return result;
}
