import "server-only";
import { Prisma, type StatusRole } from "@prisma/client";
import type { BusinessDb } from "@/lib/db";
import { orderRef } from "@/lib/orders/numbers";

/**
 * The sales pipeline: leads and quotes in one board. A lead with a quote is
 * shown as its quote, so nothing appears twice.
 */
export const STAGES = {
  NEW: "New lead",
  CONTACTED: "Contacted",
  QUOTING: "Quoting",
  SENT: "Quote sent",
  WON: "Won",
  LOST: "Lost",
} as const;
export type Stage = keyof typeof STAGES;

/** Leads can be dragged between these; quotes move with their status. */
export const LEAD_STAGES: Stage[] = ["NEW", "CONTACTED", "LOST"];

export type PipelineCard = {
  key: string;
  kind: "lead" | "quote";
  id: string;
  stage: Stage;
  title: string; // "Valley Volleyball" / "Quote Q-1022"
  who: string; // person (and organization)
  value: Prisma.Decimal | null;
  owner: string | null;
  href: string;
  since: Date; // when it reached this stage (or was last updated)
  note: string | null; // "qualified", "changes requested", "from a lead", lost reason…
};

/** A quote's stage from its status. */
export function quoteStage(status: { role: StatusRole | null; isClosed: boolean }): Stage {
  if (status.role === "QUOTE_CONVERTED" || status.role === "QUOTE_APPROVED") return "WON";
  if (status.isClosed) return "LOST";
  if (status.role === "QUOTE_SENT" || status.role === "QUOTE_CHANGES_REQUESTED") return "SENT";
  return "QUOTING";
}

/** Won and lost over the period: count, value and win rate (by count). */
export function winRate(cards: PipelineCard[]) {
  const won = cards.filter((c) => c.stage === "WON");
  const lost = cards.filter((c) => c.stage === "LOST");
  const sum = (cs: PipelineCard[]) => cs.reduce((t, c) => t.plus(c.value ?? 0), new Prisma.Decimal(0));
  const decided = won.length + lost.length;
  return { won: won.length, lost: lost.length, wonValue: sum(won), rate: decided ? won.length / decided : null };
}

/**
 * Every card on the board: open leads without a quote, every open quote,
 * and leads and quotes won or lost in the last `days` days. `ownerId`
 * limits it to one person's (a lead's owner, a quote's assignee).
 */
export async function loadPipeline(db: BusinessDb, o: { ownerId?: string | null; days: number; now?: Date }): Promise<PipelineCard[]> {
  const since = new Date((o.now ?? new Date()).getTime() - o.days * 86_400_000);
  const owner = o.ownerId ?? undefined;
  const [leads, quotes] = await Promise.all([
    db.lead.findMany({
      where: {
        quoteId: null,
        ownerId: owner,
        OR: [{ status: { in: ["NEW", "CONTACTED", "QUALIFIED"] } }, { status: "LOST", updatedAt: { gte: since } }],
      },
      include: { owner: { select: { name: true } } },
    }),
    db.order.findMany({
      where: {
        type: "QUOTE",
        assignedToId: owner,
        // Store batch/request bookkeeping aside, every quote is an opportunity.
        OR: [{ status: { isClosed: false } }, { updatedAt: { gte: since } }, { convertedTo: { createdAt: { gte: since } } }],
      },
      include: {
        status: true,
        customer: { include: { company: true } },
        assignedTo: { select: { name: true } },
        convertedTo: { select: { createdAt: true } },
        fromLeads: { select: { id: true } },
        events: { where: { type: "EMAIL", body: { startsWith: "Quote emailed" } }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    }),
  ]);

  const cards: PipelineCard[] = leads.map((l) => ({
    key: `lead:${l.id}`,
    kind: "lead",
    id: l.id,
    stage: l.status === "NEW" ? "NEW" : l.status === "LOST" ? "LOST" : "CONTACTED",
    title: l.organization ?? `${l.firstName} ${l.lastName}`.trim(),
    who: l.organization ? `${l.firstName} ${l.lastName}`.trim() : (l.email ?? l.phone ?? ""),
    value: l.estimatedValue,
    owner: l.owner?.name ?? null,
    href: `/admin/leads/${l.id}`,
    since: l.status === "NEW" ? l.createdAt : (l.lastContactAt ?? l.updatedAt),
    note: l.status === "QUALIFIED" ? "Qualified" : l.status === "LOST" ? (l.lostReason ?? "Lost") : null,
  }));

  for (const q of quotes) {
    const stage = quoteStage(q.status);
    const closedAt = q.convertedTo?.createdAt ?? q.updatedAt;
    if ((stage === "WON" || stage === "LOST") && closedAt < since) continue;
    const person = `${q.customer.firstName} ${q.customer.lastName}`.trim();
    cards.push({
      key: `quote:${q.id}`,
      kind: "quote",
      id: q.id,
      stage,
      title: `Quote ${orderRef(q)}${q.title ? ` · ${q.title}` : ""}`,
      who: q.customer.company ? `${person}, ${q.customer.company.name}` : person,
      value: q.total.isZero() ? null : q.total,
      owner: q.assignedTo?.name ?? null,
      href: `/admin/orders/${q.id}`,
      since: stage === "SENT" ? (q.events[0]?.createdAt ?? q.updatedAt) : stage === "WON" || stage === "LOST" ? closedAt : q.createdAt,
      note:
        q.status.role === "QUOTE_CHANGES_REQUESTED"
          ? "Changes requested"
          : q.status.role === "QUOTE_APPROVED"
            ? "Approved, not ordered yet"
            : stage === "LOST"
              ? q.status.name
              : q.fromLeads.length
                ? "From a lead"
                : null,
    });
  }
  // Oldest first in open stages (waiting longest); newest first once decided.
  return cards.sort((a, b) => (a.stage === "WON" || a.stage === "LOST" ? b.since.getTime() - a.since.getTime() : a.since.getTime() - b.since.getTime()));
}
