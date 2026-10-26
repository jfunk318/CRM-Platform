import "server-only";
import { type LeadEventType, type LeadStatus, Prisma } from "@prisma/client";
import type { BusinessDb, BusinessTx } from "@/lib/db";
import { isValidEmail } from "@/lib/email/mailer";
import { createOrder, OrderError } from "@/lib/orders/service";

export class LeadError extends Error {}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  CONVERTED: "Converted",
  LOST: "Lost",
};
export const OPEN_LEAD_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED"];

/** Suggested sources; staff can type any other. */
export const LEAD_SOURCES = ["Phone", "Email", "Website quote request", "Walk-in", "Referral", "Trade show", "Social media", "Past customer"];

export const CONTACT_TYPES = { CALL: "Call", EMAIL: "Email", MEETING: "Meeting", NOTE: "Note" } as const satisfies Partial<Record<LeadEventType, string>>;

export type LeadInput = {
  firstName: string;
  lastName: string;
  organization: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  interest: string | null;
  estimatedValue: Prisma.Decimal | null;
  ownerId: string | null;
};

const clean = (s: string | null | undefined, max = 200) => s?.trim().replace(/\s+/g, " ").slice(0, max) || null;

function checked(input: LeadInput): LeadInput {
  const firstName = clean(input.firstName, 80);
  if (!firstName) throw new LeadError("Enter a first name");
  const email = clean(input.email)?.toLowerCase() ?? null;
  if (email && !isValidEmail(email)) throw new LeadError("That email address doesn't look right");
  if (input.estimatedValue?.isNegative()) throw new LeadError("Estimated value can't be negative");
  return {
    firstName,
    lastName: clean(input.lastName, 80) ?? "",
    organization: clean(input.organization),
    title: clean(input.title, 100),
    email,
    phone: clean(input.phone, 40),
    source: clean(input.source, 80),
    interest: input.interest?.trim().slice(0, 2000) || null,
    estimatedValue: input.estimatedValue,
    ownerId: input.ownerId || null,
  };
}

export async function logLeadEvent(tx: BusinessTx, leadId: string, type: LeadEventType, body: string, staffId: string | null) {
  await tx.leadEvent.create({ data: { businessId: tx.$businessId, leadId, type, body, staffId } });
}

/**
 * Customers and open leads that look like the same person (same email or
 * phone), so staff don't add someone twice.
 */
export async function possibleDuplicates(db: BusinessDb, l: { email: string | null; phone: string | null }, exceptLeadId?: string) {
  const digits = l.phone?.replace(/\D/g, "") ?? "";
  // The last 7 digits, compared without spaces, dashes or brackets.
  const phone = digits.length >= 7 ? `%${digits.slice(-7)}` : null;
  if (!l.email && !phone) return { customers: [], leads: [] };
  const businessId = db.$businessId;
  const [customerPhones, leadPhones] = phone
    ? await Promise.all([
        db.$queryRaw<{ id: string }[]>`SELECT id FROM "Customer" WHERE "businessId" = ${businessId} AND regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') LIKE ${phone} LIMIT 5`,
        db.$queryRaw<{ id: string }[]>`SELECT id FROM "Lead" WHERE "businessId" = ${businessId} AND regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') LIKE ${phone} LIMIT 5`,
      ])
    : [[], []];
  const byEmail = l.email ? [{ email: { equals: l.email, mode: "insensitive" as const } }] : [];
  const [customers, leads] = await Promise.all([
    db.customer.findMany({
      where: { OR: [...byEmail, { id: { in: customerPhones.map((r) => r.id) } }] },
      select: { id: true, firstName: true, lastName: true, email: true, company: { select: { name: true } } },
      take: 5,
    }),
    db.lead.findMany({
      where: { id: exceptLeadId ? { not: exceptLeadId } : undefined, status: { in: OPEN_LEAD_STATUSES }, OR: [...byEmail, { id: { in: leadPhones.map((r) => r.id) } }] },
      select: { id: true, firstName: true, lastName: true, organization: true, status: true },
      take: 5,
    }),
  ]);
  return { customers, leads };
}

export async function createLead(db: BusinessDb, input: LeadInput, staffId: string | null, extra: { customerId?: string; quoteId?: string } = {}): Promise<string> {
  const data = checked(input);
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.create({ data: { ...data, businessId: db.$businessId, createdById: staffId, customerId: extra.customerId, quoteId: extra.quoteId } });
    await logLeadEvent(tx, lead.id, "CREATED", `Lead added${data.source ? ` (${data.source})` : ""}`, staffId);
    return lead.id;
  });
}

/** Save edits; status and owner changes are noted on the timeline. */
export async function updateLead(db: BusinessDb, leadId: string, input: LeadInput & { status: LeadStatus; lostReason?: string | null }, staffId: string | null) {
  const data = checked(input);
  const before = await db.lead.findUniqueOrThrow({ where: { id: leadId }, include: { owner: true } });
  if (input.status === "CONVERTED" && before.status !== "CONVERTED") throw new LeadError("Use Convert to make the customer");
  const lostReason = input.status === "LOST" ? clean(input.lostReason, 300) : null;
  await db.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: leadId }, data: { ...data, status: input.status, lostReason } });
    const changes: string[] = [];
    if (before.status !== input.status) changes.push(`Status: ${LEAD_STATUS_LABELS[before.status]} → ${LEAD_STATUS_LABELS[input.status]}${lostReason ? ` (${lostReason})` : ""}`);
    if (before.ownerId !== data.ownerId) {
      const owner = data.ownerId ? await tx.staffUser.findUnique({ where: { id: data.ownerId } }) : null;
      changes.push(`Owner: ${owner?.name ?? "nobody"}`);
    }
    if (changes.length) await logLeadEvent(tx, leadId, "STATUS", changes.join("\n"), staffId);
  });
}

/**
 * Record a call, email, meeting or note. Contact with a new lead moves it to
 * Contacted.
 */
export async function logContact(db: BusinessDb, leadId: string, type: keyof typeof CONTACT_TYPES, body: string, staffId: string | null) {
  const text = body.trim().slice(0, 5000);
  if (!text) throw new LeadError("Write what happened");
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  await db.$transaction(async (tx) => {
    await logLeadEvent(tx, leadId, type, text, staffId);
    if (type !== "NOTE") {
      await tx.lead.update({ where: { id: leadId }, data: { lastContactAt: new Date(), ...(lead.status === "NEW" ? { status: "CONTACTED" } : {}) } });
      if (lead.status === "NEW") await logLeadEvent(tx, leadId, "STATUS", "Status: New → Contacted", staffId);
    }
  });
}

/**
 * Turn a lead into a customer: the customer already linked, or the one with
 * the same email, or a new one; their organization becomes (or matches) a
 * company. Optionally starts a draft quote. Returns where to go next.
 */
export async function convertLead(db: BusinessDb, leadId: string, o: { makeQuote: boolean }, staffId: string | null): Promise<{ customerId: string; quoteId: string | null }> {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (lead.status === "CONVERTED" && lead.customerId) return { customerId: lead.customerId, quoteId: lead.quoteId };

  const result = await db.$transaction(async (tx) => {
    const company = lead.organization
      ? ((await tx.company.findFirst({ where: { name: { equals: lead.organization, mode: "insensitive" } }, orderBy: { createdAt: "asc" } })) ??
        (await tx.company.create({ data: { businessId: tx.$businessId, name: lead.organization, phone: lead.phone } })))
      : null;
    let customer =
      (lead.customerId ? await tx.customer.findUnique({ where: { id: lead.customerId } }) : null) ??
      (lead.email ? await tx.customer.findFirst({ where: { email: { equals: lead.email, mode: "insensitive" } }, orderBy: { createdAt: "asc" } }) : null);
    const isNew = !customer;
    if (!customer) {
      customer = await tx.customer.create({
        data: {
          businessId: tx.$businessId,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          phone: lead.phone,
          companyId: company?.id,
          notes: [lead.title, lead.interest].filter(Boolean).join("\n") || null,
        },
      });
    } else if (company && !customer.companyId) {
      customer = await tx.customer.update({ where: { id: customer.id }, data: { companyId: company.id } });
    }
    await tx.lead.update({ where: { id: leadId }, data: { status: "CONVERTED", convertedAt: new Date(), customerId: customer.id } });
    await logLeadEvent(tx, leadId, "CONVERTED", `Converted: ${isNew ? "new customer" : "matched existing customer"} ${customer.firstName} ${customer.lastName}`.trim() + (company ? ` at ${company.name}` : ""), staffId);
    return customer.id;
  });

  let quoteId = lead.quoteId;
  if (o.makeQuote && !quoteId) {
    try {
      quoteId = await createOrder(db, { type: "QUOTE", customerId: result, staffId, title: (lead.interest?.split("\n")[0] ?? lead.organization ?? null)?.slice(0, 150) ?? null });
    } catch (e) {
      if (e instanceof OrderError) throw new LeadError(e.message);
      throw e;
    }
    await db.lead.update({ where: { id: leadId }, data: { quoteId } });
    await db.$transaction(async (tx) => logLeadEvent(tx, leadId, "CONVERTED", "Draft quote started", staffId));
  }
  return { customerId: result, quoteId };
}

/** Open leads' estimated value and counts by status, for the list's header. */
export async function leadSummary(db: BusinessDb) {
  const rows = await db.lead.groupBy({ by: ["status"], _count: true, _sum: { estimatedValue: true } });
  const by = Object.fromEntries(rows.map((r) => [r.status, r])) as Partial<Record<LeadStatus, (typeof rows)[number]>>;
  const openValue = OPEN_LEAD_STATUSES.reduce((t, s) => t.plus(by[s]?._sum.estimatedValue ?? 0), new Prisma.Decimal(0));
  return { counts: Object.fromEntries((Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((s) => [s, by[s]?._count ?? 0])) as Record<LeadStatus, number>, openValue };
}
