// Quote approval, proofs, payments and invoices, against the database in
// DATABASE_URL, inside throwaway businesses.
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { forBusiness, prisma } from "@/lib/db";
import { makeTestBusiness } from "@/test/fixtures";
import {
  createProof,
  customerApproveQuote,
  customerRequestQuoteChanges,
  customerRespondToProof,
  orderByToken,
  sendProof,
  sendQuote,
} from "./customer-flow";
import { issueInvoice, recordPayment, sendInvoice, setDeposit } from "./payments";
import { addLine, convertQuote, createOrder, OrderError } from "./service";

let t: Awaited<ReturnType<typeof makeTestBusiness>>;
let other: Awaited<ReturnType<typeof makeTestBusiness>>;
const origin = "http://shop.localhost:3000";
const png = (name = "proof.png") => new File([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], name, { type: "image/png" });

beforeAll(async () => {
  t = await makeTestBusiness(`flow-${Date.now()}`);
  other = await makeTestBusiness(`flow-other-${Date.now()}`);
});
afterAll(async () => {
  await t.cleanup();
  await other.cleanup();
  await prisma.$disconnect();
});

const statusOf = async (orderId: string) => (await t.db.order.findUniqueOrThrow({ where: { id: orderId }, include: { status: true } })).status;

describe("quote approval", () => {
  let quoteId = "";
  let token = "";

  it("sends a quote by email and moves it to Sent", async () => {
    quoteId = await createOrder(t.db, { type: "QUOTE", customerId: t.customer.id, staffId: t.staff.id });
    await expect(sendQuote(t.db, quoteId, { origin, staffId: t.staff.id })).rejects.toThrow(/at least one item/);
    await addLine(t.db, quoteId, t.line(), t.staff.id);
    const result = await sendQuote(t.db, quoteId, { origin, staffId: t.staff.id, message: "Thanks!" });
    expect(result.status).toBe("LOGGED"); // no email provider in tests
    const q = await t.db.order.findUniqueOrThrow({ where: { id: quoteId }, include: { emails: true } });
    expect(q.total.toFixed(2)).toBe("160.00"); // 12 × $10.00 + 2 screens × $20
    token = q.publicToken!;
    expect(token.length).toBeGreaterThanOrEqual(30);
    expect(q.emails[0].text).toContain(`${origin}/c/${token}`);
    expect((await statusOf(quoteId)).role).toBe("QUOTE_SENT");
  });

  it("keeps the link private to the business", async () => {
    expect(await orderByToken(t.db, token)).not.toBeNull();
    expect(await orderByToken(other.db, token)).toBeNull();
    expect(await orderByToken(t.db, "short")).toBeNull();
  });

  it("records a change request and alerts the assigned staff member", async () => {
    await customerRequestQuoteChanges(t.db, token, { name: "Pat", note: "Can we do 24 instead?", origin });
    expect((await statusOf(quoteId)).role).toBe("QUOTE_CHANGES_REQUESTED");
    const alert = await t.db.emailMessage.findFirst({ where: { orderId: quoteId, to: "rep@example.com" } });
    expect(alert?.subject).toBe("Pat asked for changes to quote Q-1001");
  });

  it("records approval, and clears it if the quote changes afterwards", async () => {
    await expect(customerApproveQuote(t.db, token, { name: " ", origin })).rejects.toThrow(/Type your name/);
    await customerApproveQuote(t.db, token, { name: "Pat Lee", origin });
    let q = await t.db.order.findUniqueOrThrow({ where: { id: quoteId }, include: { status: true } });
    expect(q.approvedByName).toBe("Pat Lee");
    expect(q.status.role).toBe("QUOTE_APPROVED");

    await addLine(t.db, quoteId, t.line(12), t.staff.id);
    q = await t.db.order.findUniqueOrThrow({ where: { id: quoteId }, include: { status: true } });
    expect(q.approvedAt).toBeNull();
    await customerApproveQuote(t.db, token, { name: "Pat Lee", origin });
  });

  it("carries the approval to the order and closes the quote link", async () => {
    const orderId = await convertQuote(t.db, quoteId, t.staff.id);
    const order = await t.db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.approvedByName).toBe("Pat Lee");
    // The customer already has a link, so the order gets its own.
    expect(order.publicToken).toBeTruthy();
    expect(order.publicToken).not.toBe(token);
    expect((await orderByToken(t.db, order.publicToken!))?.id).toBe(orderId);
    await expect(customerRequestQuoteChanges(t.db, token, { name: "Pat", note: "x", origin })).rejects.toThrow(/closed/);
  });
});

describe("proofs", () => {
  let orderId = "";

  beforeAll(async () => {
    orderId = await createOrder(t.db, { type: "ORDER", customerId: t.customer.id, staffId: t.staff.id });
    await addLine(t.db, orderId, t.line(), t.staff.id);
  });

  it("creates a proof from an upload, sends it, and retires older proofs", async () => {
    await expect(createProof(t.db, orderId, { orderFileIds: [], uploads: [], message: null, staffId: null })).rejects.toThrow(OrderError);
    await expect(
      createProof(t.db, orderId, { orderFileIds: [], uploads: [new File(["x"], "virus.exe")], message: null, staffId: null }),
    ).rejects.toThrow(/isn't accepted/);

    const p1 = await createProof(t.db, orderId, { orderFileIds: [], uploads: [png()], message: "Check the colors", staffId: t.staff.id });
    expect(p1.number).toBe(1);
    expect(p1.status).toBe("DRAFT");
    await sendProof(t.db, p1.id, { origin, staffId: t.staff.id });
    expect((await statusOf(orderId)).role).toBe("ORDER_PROOF_SENT");

    // A second proof reusing the order's mockup file.
    const mockup = await t.db.orderFile.findFirstOrThrow({ where: { orderId, kind: "MOCKUP" } });
    const p2 = await createProof(t.db, orderId, { orderFileIds: [mockup.id], uploads: [], message: null, staffId: t.staff.id });
    await sendProof(t.db, p2.id, { origin, staffId: t.staff.id });
    expect((await t.db.proof.findUniqueOrThrow({ where: { id: p1.id } })).status).toBe("CANCELLED");

    await expect(
      customerRespondToProof(t.db, p1.token, { approve: true, name: "Pat", note: "", uploads: [], origin }),
    ).rejects.toThrow(/already been answered or replaced/);
  });

  it("takes the customer's change request with a file, then their approval", async () => {
    const p2 = await t.db.proof.findFirstOrThrow({ where: { orderId, number: 2 } });
    await expect(customerRespondToProof(t.db, p2.token, { approve: false, name: "Pat", note: "", uploads: [], origin })).rejects.toThrow(
      /what you'd like changed/,
    );
    await customerRespondToProof(t.db, p2.token, { approve: false, name: "Pat", note: "Bigger logo", uploads: [png("ref.png")], origin });
    expect((await statusOf(orderId)).role).toBe("ORDER_CHANGES_REQUESTED");
    const customerFiles = await t.db.orderFile.findMany({ where: { orderId, kind: "CUSTOMER" }, include: { file: true } });
    expect(customerFiles.map((f) => f.file.name)).toEqual(["ref.png"]);

    const p3 = await createProof(t.db, orderId, { orderFileIds: [], uploads: [png("v3.png")], message: null, staffId: t.staff.id });
    await sendProof(t.db, p3.id, { origin, staffId: t.staff.id });
    await customerRespondToProof(t.db, p3.token, { approve: true, name: "Pat", note: "Looks great", uploads: [], origin });
    expect((await statusOf(orderId)).role).toBe("ORDER_ARTWORK_APPROVED");
    expect((await t.db.proof.findUniqueOrThrow({ where: { id: p3.id } })).responderName).toBe("Pat");
  });

  it("stores files where another business can't reach them", async () => {
    const f = await t.db.storedFile.findFirstOrThrow({ where: { name: "ref.png" } });
    expect(f.storageKey.startsWith(`${t.business.id}/`)).toBe(true);
    expect(await other.db.storedFile.findUnique({ where: { id: f.id } })).toBeNull();
    expect(await forBusiness(other.business.id).proofFile.count()).toBe(0);
  });
});

describe("payments and invoices", () => {
  let orderId = "";

  beforeAll(async () => {
    orderId = await createOrder(t.db, { type: "ORDER", customerId: t.customer.id, staffId: t.staff.id });
    await addLine(t.db, orderId, t.line(), t.staff.id); // $160.00
  });

  const D = (v: string) => new Prisma.Decimal(v);
  const pay = (amount: string, refund = false) =>
    recordPayment(t.db, orderId, { amount: D(amount), refund, method: "CHECK", reference: "1042", note: null, receivedAt: new Date(), staffId: t.staff.id });

  it("tracks deposits, payments and refunds", async () => {
    await expect(setDeposit(t.db, orderId, D("500"), null)).rejects.toThrow(/more than the total/);
    await setDeposit(t.db, orderId, D("80"), null);
    await pay("100");
    await expect(pay("150", true)).rejects.toThrow(/at most \$100.00/);
    await pay("30", true);
    const o = await t.db.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true } });
    expect(o.paidTotal.toFixed(2)).toBe("70.00");
    expect(o.payments.map((p) => p.amount.toFixed(2))).toEqual(["100.00", "-30.00"]);
    await expect(pay("0")).rejects.toThrow(/above zero/);
  });

  it("numbers invoices per business, once per order", async () => {
    const first = await issueInvoice(t.db, orderId, { dueDate: null, staffId: null });
    expect(first).toBe(1001);
    expect(await issueInvoice(t.db, orderId, { dueDate: new Date("2026-12-01"), staffId: null })).toBe(1001);
    const result = await sendInvoice(t.db, orderId, { origin, staffId: null });
    expect(result.status).toBe("LOGGED");
    const email = await t.db.emailMessage.findFirstOrThrow({ where: { orderId, subject: { startsWith: "Invoice" } } });
    expect(email.text).toContain("balance due $90.00");

    // Another business's invoices start their own sequence.
    const otherOrder = await createOrder(other.db, { type: "ORDER", customerId: other.customer.id, staffId: null });
    await addLine(other.db, otherOrder, other.line(), null);
    expect(await issueInvoice(other.db, otherOrder, { dueDate: null, staffId: null })).toBe(1001);
  });

  it("only takes payments on orders, not quotes", async () => {
    const quote = await createOrder(t.db, { type: "QUOTE", customerId: t.customer.id, staffId: null });
    await expect(
      recordPayment(t.db, quote, { amount: D("5"), refund: false, method: "CASH", reference: null, note: null, receivedAt: new Date(), staffId: null }),
    ).rejects.toThrow(/on orders/);
  });
});
