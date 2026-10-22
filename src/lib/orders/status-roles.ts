import type { OrderType, StatusRole } from "@prisma/client";

/** What each role means, in the words shown next to the status in admin. */
export const STATUS_ROLES: Record<StatusRole, { type: OrderType; label: string }> = {
  QUOTE_SENT: { type: "QUOTE", label: "When the quote is emailed" },
  QUOTE_CHANGES_REQUESTED: { type: "QUOTE", label: "When the customer asks for changes" },
  QUOTE_APPROVED: { type: "QUOTE", label: "When the customer approves" },
  QUOTE_CONVERTED: { type: "QUOTE", label: "When it becomes an order" },
  ORDER_PROOF_SENT: { type: "ORDER", label: "When a proof is sent" },
  ORDER_CHANGES_REQUESTED: { type: "ORDER", label: "When the customer asks for proof changes" },
  ORDER_ARTWORK_APPROVED: { type: "ORDER", label: "When the customer approves a proof" },
};

export const rolesFor = (type: OrderType) =>
  (Object.keys(STATUS_ROLES) as StatusRole[]).filter((r) => STATUS_ROLES[r].type === type);

export const isStatusRole = (v: string): v is StatusRole => v in STATUS_ROLES;
