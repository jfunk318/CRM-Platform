import "server-only";
import type { Business, Order, StoredFile } from "@prisma/client";
import type { BusinessDb, BusinessTx } from "@/lib/db";
import { deliveryNote, isValidEmail, sendEmail } from "@/lib/email/mailer";
import { proofEmail, quoteEmail, staffAlertEmail } from "@/lib/email/templates";
import { saveUpload } from "@/lib/files/storage";
import { designMockups, renderMockup } from "@/lib/design/mockups";
import { addToLibrary, orderOwner } from "@/lib/design/library";
import { createProductionJobs } from "@/lib/production/jobs";
import { orderRef } from "./numbers";
import { logEvent, moveToRole, newToken, OrderError } from "./service";

// Quote approval and artwork proofs: what staff send and how customers
// respond through their private links.


const brandOf = (b: Business) => ({ name: b.name, email: b.email, phone: b.phone });

/** The order's customer link token, created the first time it's needed. */
export async function ensurePublicToken(db: BusinessTx, orderId: string): Promise<string> {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.publicToken) return order.publicToken;
  const token = newToken();
  await db.order.update({ where: { id: orderId }, data: { publicToken: token } });
  return token;
}

export const customerLink = (origin: string, token: string) => `${origin}/c/${token}`;
export const proofLink = (origin: string, token: string) => `${origin}/proof/${token}`;

function hasPricingErrors(lines: { issues: unknown }[]): boolean {
  return lines.some((l) => (l.issues as { severity: string }[]).some((i) => i.severity === "error"));
}

/** Email the assigned staff member (or the business inbox) when a customer responds. */
async function alertStaff(db: BusinessTx, order: Order, heading: string, lines: string[], origin: string) {
  const [business, assignee] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: db.$businessId } }),
    order.assignedToId ? db.staffUser.findUnique({ where: { id: order.assignedToId } }) : null,
  ]);
  const to = assignee?.active && isValidEmail(assignee.email) ? assignee.email : business.email;
  if (!isValidEmail(to)) return;
  const content = staffAlertEmail({ brand: brandOf(business), heading, lines, url: `${origin}/admin/orders/${order.id}` });
  await sendEmail(db, { ...content, to, fromName: business.name, orderId: order.id });
}

// ─── Quotes ─────────────────────────────────────────────────────────────────

/** Email the customer a link to review and approve the quote. */
export async function sendQuote(
  db: BusinessDb,
  orderId: string,
  o: { origin: string; staffId: string | null; message?: string | null },
) {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { customer: true, lines: true, convertedTo: true },
  });
  if (order.type !== "QUOTE") throw new OrderError("Only quotes are sent for approval");
  if (order.convertedTo) throw new OrderError("This quote is already an order");
  if (order.lines.length === 0) throw new OrderError("Add at least one item before sending");
  if (hasPricingErrors(order.lines)) throw new OrderError("Fix the pricing problems before sending");
  if (!isValidEmail(order.customer.email)) throw new OrderError("Add an email address to the customer first");

  const business = await db.business.findUniqueOrThrow({ where: { id: db.$businessId } });
  const token = await ensurePublicToken(db, orderId);
  const content = quoteEmail({
    brand: brandOf(business),
    customerName: order.customer.firstName,
    ref: orderRef(order),
    total: order.total.toFixed(2),
    url: customerLink(o.origin, token),
    message: o.message,
  });
  const result = await sendEmail(db, { ...content, to: order.customer.email, fromName: business.name, replyTo: business.email, orderId });
  await logEvent(db, db.$businessId, orderId, "EMAIL", `Quote emailed to ${order.customer.email}${deliveryNote(result.status)}`, o.staffId);
  if (result.status !== "FAILED") await moveToRole(db, db.$businessId, orderId, "QUOTE_SENT", o.staffId, "quote emailed");
  return result;
}

/** Find a quote/order by its customer link, within the business. */
export async function orderByToken(db: BusinessTx, token: string) {
  if (!token || token.length < 20) return null;
  return db.order.findFirst({
    where: { publicToken: token },
    include: {
      customer: true,
      status: true,
      convertedTo: true,
      lines: {
        orderBy: { sortOrder: "asc" },
        include: {
          sizes: { include: { size: true }, orderBy: { size: { sortOrder: "asc" } } },
          design: { include: { product: true, color: true, decorations: { orderBy: { sortOrder: "asc" }, include: { method: true } } } },
        },
      },
      proofs: { where: { status: { not: "DRAFT" } }, orderBy: { number: "desc" } },
      payments: { orderBy: { receivedAt: "asc" } },
      deliveryMethod: true,
      shipments: { include: { items: true }, orderBy: { shippedAt: "asc" } },
    },
  });
}

/** The customer approves the quote as it stands now. */
export async function customerApproveQuote(db: BusinessDb, token: string, o: { name: string; origin: string }) {
  const name = o.name.trim();
  if (!name) throw new OrderError("Type your name to approve");
  const order = await orderByToken(db, token);
  if (!order || order.type !== "QUOTE") throw new OrderError("This quote link isn't valid");
  if (order.convertedTo || order.status.isClosed) throw new OrderError("This quote is closed");
  if (order.approvedAt) return;
  if (hasPricingErrors(order.lines)) throw new OrderError("This quote isn't ready yet. We'll be in touch.");

  await db.order.update({ where: { id: order.id }, data: { approvedAt: new Date(), approvedByName: name.slice(0, 120) } });
  await logEvent(db, db.$businessId, order.id, "CUSTOMER", `${name} approved the quote online ($${order.total.toFixed(2)})`, null);
  await moveToRole(db, db.$businessId, order.id, "QUOTE_APPROVED", null, "customer approved online");
  await alertStaff(db, order, `${name} approved quote ${orderRef(order)}`, [`Total $${order.total.toFixed(2)}`, "Convert it to an order when you're ready."], o.origin);
}

/** The customer asks for changes to the quote. */
export async function customerRequestQuoteChanges(db: BusinessDb, token: string, o: { name: string; note: string; origin: string }) {
  const name = o.name.trim();
  const note = o.note.trim();
  if (!name || !note) throw new OrderError("Add your name and what you'd like changed");
  const order = await orderByToken(db, token);
  if (!order || order.type !== "QUOTE") throw new OrderError("This quote link isn't valid");
  if (order.convertedTo || order.status.isClosed) throw new OrderError("This quote is closed");

  await logEvent(db, db.$businessId, order.id, "CUSTOMER", `${name} asked for changes: ${note.slice(0, 2000)}`, null);
  await moveToRole(db, db.$businessId, order.id, "QUOTE_CHANGES_REQUESTED", null, "customer asked for changes");
  await alertStaff(db, order, `${name} asked for changes to quote ${orderRef(order)}`, [note.slice(0, 2000)], o.origin);
}

// ─── Proofs ─────────────────────────────────────────────────────────────────

/** Start a proof from files already on the order and/or new uploads. */
export async function createProof(
  db: BusinessDb,
  orderId: string,
  o: { orderFileIds: string[]; uploads: File[]; message: string | null; staffId: string | null; mockups?: boolean },
) {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { files: true, _count: { select: { proofs: true } }, lines: { orderBy: { sortOrder: "asc" }, include: { design: { include: { product: true, color: true } } } } },
  });
  if (order.type !== "ORDER") throw new OrderError("Proofs are sent on orders");
  const existing = order.files.filter((f) => o.orderFileIds.includes(f.id));

  // Mockup images of every item with placed artwork, made now so the proof shows exactly what was approved.
  const rendered: File[] = [];
  if (o.mockups) {
    const mockups = await designMockups(db, order.lines.map((l) => l.designId));
    for (const line of order.lines) {
      for (const m of mockups.get(line.designId) ?? []) {
        const png = await renderMockup(db, m);
        rendered.push(new File([new Uint8Array(png)], `${line.design.product.name} ${line.design.color.name} ${m.viewName} mockup.png`.replace(/[^\w .-]+/g, " ").replace(/\s+/g, " "), { type: "image/png" }));
      }
    }
  }
  if (existing.length + o.uploads.length + rendered.length === 0) {
    throw new OrderError(o.mockups ? "No items have artwork placed yet; place artwork on an item, or choose or upload proof files" : "Choose or upload at least one proof file");
  }

  const uploaded: StoredFile[] = [];
  for (const file of [...rendered, ...o.uploads]) uploaded.push(await saveUpload(db, file, o.staffId));
  const businessId = db.$businessId;
  const proof = await db.$transaction(async (tx) => {
    for (const f of uploaded) await tx.orderFile.create({ data: { businessId, orderId, fileId: f.id, kind: "MOCKUP" } });
    const p = await tx.proof.create({
      data: {
        businessId,
        orderId,
        number: order._count.proofs + 1,
        token: newToken(),
        message: o.message,
        createdById: o.staffId,
        files: {
          create: [...existing.map((f) => f.fileId), ...uploaded.map((f) => f.id)].map((fileId, i) => ({ fileId, sortOrder: i })),
        },
      },
    });
    await logEvent(tx, businessId, orderId, "PROOF", `Proof ${p.number} created`, o.staffId);
    return p;
  });
  return proof;
}

/** Send a proof to the customer. Any earlier proof still waiting is retired. */
export async function sendProof(db: BusinessDb, proofId: string, o: { origin: string; staffId: string | null }) {
  const proof = await db.proof.findUniqueOrThrow({ where: { id: proofId }, include: { order: { include: { customer: true } } } });
  if (proof.status !== "DRAFT" && proof.status !== "SENT") throw new OrderError("This proof has already been answered or cancelled");
  if (!isValidEmail(proof.order.customer.email)) throw new OrderError("Add an email address to the customer first");
  const business = await db.business.findUniqueOrThrow({ where: { id: db.$businessId } });
  const businessId = db.$businessId;

  await db.$transaction(async (tx) => {
    await tx.proof.updateMany({
      where: { orderId: proof.orderId, status: "SENT", id: { not: proof.id } },
      data: { status: "CANCELLED" },
    });
    await tx.proof.update({ where: { id: proof.id }, data: { status: "SENT", sentAt: new Date() } });
  });
  const content = proofEmail({
    brand: brandOf(business),
    customerName: proof.order.customer.firstName,
    ref: orderRef(proof.order),
    proofNumber: proof.number,
    url: proofLink(o.origin, proof.token),
    message: proof.message,
  });
  const result = await sendEmail(db, { ...content, to: proof.order.customer.email, fromName: business.name, replyTo: business.email, orderId: proof.orderId });
  await logEvent(db, businessId, proof.orderId, "PROOF", `Proof ${proof.number} sent to ${proof.order.customer.email}${deliveryNote(result.status)}`, o.staffId);
  await moveToRole(db, businessId, proof.orderId, "ORDER_PROOF_SENT", o.staffId, `proof ${proof.number} sent`);
  return result;
}

export async function cancelProof(db: BusinessDb, proofId: string, staffId: string | null) {
  const proof = await db.proof.findUniqueOrThrow({ where: { id: proofId } });
  if (proof.status !== "DRAFT" && proof.status !== "SENT") throw new OrderError("Only waiting or draft proofs can be cancelled");
  await db.proof.update({ where: { id: proofId }, data: { status: "CANCELLED" } });
  await logEvent(db, db.$businessId, proof.orderId, "PROOF", `Proof ${proof.number} cancelled`, staffId);
}

export async function proofByToken(db: BusinessTx, token: string) {
  if (!token || token.length < 20) return null;
  return db.proof.findFirst({
    where: { token, status: { not: "DRAFT" } },
    include: {
      order: {
        include: {
          customer: true,
          lines: {
            orderBy: { sortOrder: "asc" },
            include: {
              sizes: { include: { size: true }, orderBy: { size: { sortOrder: "asc" } } },
              design: { include: { product: true, color: true, decorations: { orderBy: { sortOrder: "asc" }, include: { method: true } } } },
            },
          },
        },
      },
      files: { orderBy: { sortOrder: "asc" }, include: { file: true } },
    },
  });
}

/** The customer approves a proof or asks for changes (optionally with files). */
export async function customerRespondToProof(
  db: BusinessDb,
  token: string,
  o: { approve: boolean; name: string; note: string; uploads: File[]; origin: string },
) {
  const name = o.name.trim();
  const note = o.note.trim();
  if (!name) throw new OrderError("Type your name");
  if (!o.approve && !note) throw new OrderError("Tell us what you'd like changed");
  const proof = await proofByToken(db, token);
  if (!proof) throw new OrderError("This proof link isn't valid");
  if (proof.status !== "SENT") throw new OrderError("This proof has already been answered or replaced");

  const uploaded: StoredFile[] = [];
  for (const file of o.uploads) uploaded.push(await saveUpload(db, file, null));
  const businessId = db.$businessId;
  await db.$transaction(async (tx) => {
    await tx.proof.update({
      where: { id: proof.id },
      data: {
        status: o.approve ? "APPROVED" : "CHANGES_REQUESTED",
        respondedAt: new Date(),
        responderName: name.slice(0, 120),
        responseNote: note.slice(0, 4000) || null,
        files: { create: uploaded.map((f, i) => ({ fileId: f.id, fromCustomer: true, sortOrder: 100 + i })) },
      },
    });
    for (const f of uploaded) {
      await tx.orderFile.create({ data: { businessId, orderId: proof.orderId, fileId: f.id, kind: "CUSTOMER", note: `With proof ${proof.number} response` } });
    }
    await addToLibrary(tx, await orderOwner(tx, proof.orderId), uploaded);
    const files = uploaded.length ? ` (${uploaded.length} file${uploaded.length === 1 ? "" : "s"} attached)` : "";
    await logEvent(
      tx,
      businessId,
      proof.orderId,
      "CUSTOMER",
      o.approve
        ? `${name} approved proof ${proof.number}${note ? `: ${note}` : ""}${files}`
        : `${name} asked for changes to proof ${proof.number}: ${note}${files}`,
      null,
    );
  });
  await moveToRole(
    db,
    businessId,
    proof.orderId,
    o.approve ? "ORDER_ARTWORK_APPROVED" : "ORDER_CHANGES_REQUESTED",
    null,
    o.approve ? `customer approved proof ${proof.number}` : `customer asked for changes to proof ${proof.number}`,
  );
  // Approved artwork is ready for the floor.
  if (o.approve) {
    await createProductionJobs(db, proof.orderId, null).catch((e) => {
      if (!(e instanceof OrderError)) throw e;
    });
  }
  await alertStaff(
    db,
    proof.order,
    o.approve
      ? `${name} approved proof ${proof.number} for order ${orderRef(proof.order)}`
      : `${name} asked for changes to proof ${proof.number} for order ${orderRef(proof.order)}`,
    [note || "No note.", ...(uploaded.length ? [`${uploaded.length} file(s) attached.`] : [])],
    o.origin,
  );
}
