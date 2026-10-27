"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { LeadError, setLeadStatus } from "@/lib/crm/leads";

/** A lead dragged to another column on the board. */
export async function moveLeadAction(leadId: string, stage: "NEW" | "CONTACTED" | "LOST", reason: string | null): Promise<{ error?: string }> {
  const staff = await requireStaff(["SALES"]);
  if (!["NEW", "CONTACTED", "LOST"].includes(stage)) return { error: "Leads can move to New, Contacted or Lost" };
  try {
    await setLeadStatus(staff.db, leadId, stage, reason, staff.id);
  } catch (e) {
    if (e instanceof LeadError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin/pipeline");
  revalidatePath("/admin/leads", "layout");
  return {};
}
