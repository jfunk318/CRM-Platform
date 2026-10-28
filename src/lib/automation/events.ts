import "server-only";
import type { AutomationTrigger } from "@prisma/client";
import { after } from "next/server";
import { backOfficeOrigin, getRequestStoreSlug, requestOrigin } from "@/lib/business";
import type { BusinessTx } from "@/lib/db";

export type AutomationEventInput = {
  trigger: AutomationTrigger;
  orderId?: string;
  leadId?: string;
  requestId?: string;
  statusId?: string;
  depth?: number;
};

/**
 * Note that something happened, inside the same transaction as the change
 * itself, and run the rules for it once the request has finished. Outside a
 * request (tests, scripts) the hourly sweep picks it up.
 */
export async function emitAutomation(tx: BusinessTx, ev: AutomationEventInput) {
  // Cheap check first: most businesses have few rules, and none for most triggers.
  if (!(await tx.automationRule.count({ where: { trigger: ev.trigger, active: true } }))) return;
  let origin: string | null = null;
  try {
    origin = backOfficeOrigin(await requestOrigin(), await getRequestStoreSlug());
  } catch {
    // Not in a request.
  }
  await tx.automationEvent.create({ data: { businessId: tx.$businessId, ...ev, depth: ev.depth ?? 0, origin } });
  const businessId = tx.$businessId;
  try {
    after(async () => {
      const { runAutomations } = await import("./engine");
      const { forBusiness } = await import("@/lib/db");
      await runAutomations(forBusiness(businessId));
    });
  } catch {
    // Not in a request; the hourly sweep (or a test) runs it.
  }
}
