"use server";

import { revalidatePath } from "next/cache";
import { forBusiness } from "@/lib/db";
import { getRequestBusiness, requestOrigin } from "@/lib/business";
import { type ActionResult, FormError, runAction } from "@/lib/admin/form";
import { customerApproveQuote, customerRequestQuoteChanges } from "@/lib/orders/customer-flow";
import { OrderError } from "@/lib/orders/service";

/** Customer actions run for the business whose address the link is on. */
async function customerDb() {
  const business = await getRequestBusiness();
  if (!business || business.status !== "ACTIVE") throw new FormError("This link isn't available.");
  return forBusiness(business.id);
}

async function run(token: string, fn: () => Promise<void>, ok: string): Promise<ActionResult> {
  return runAction(async () => {
    try {
      await fn();
    } catch (e) {
      if (e instanceof OrderError) throw new FormError(e.message);
      throw e;
    }
    revalidatePath(`/c/${token}`);
    return ok;
  });
}

export async function approveQuote(_: ActionResult, form: FormData): Promise<ActionResult> {
  const token = String(form.get("token") ?? "");
  return run(
    token,
    async () => {
      if (form.get("agree") !== "on") throw new OrderError("Tick the box to confirm");
      await customerApproveQuote(await customerDb(), token, { name: String(form.get("name") ?? ""), origin: await requestOrigin() });
    },
    "Thank you! Your quote is approved. We'll be in touch about next steps.",
  );
}

export async function requestQuoteChanges(_: ActionResult, form: FormData): Promise<ActionResult> {
  const token = String(form.get("token") ?? "");
  return run(
    token,
    async () =>
      customerRequestQuoteChanges(await customerDb(), token, {
        name: String(form.get("name") ?? ""),
        note: String(form.get("note") ?? ""),
        origin: await requestOrigin(),
      }),
    "Thanks, we've got your request and will send an updated quote.",
  );
}
