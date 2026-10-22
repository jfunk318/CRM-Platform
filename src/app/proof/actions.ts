"use server";

import { revalidatePath } from "next/cache";
import { forBusiness } from "@/lib/db";
import { getRequestBusiness, requestOrigin } from "@/lib/business";
import { type ActionResult, FormError, runAction } from "@/lib/admin/form";
import { formFiles, UploadError } from "@/lib/files/storage";
import { customerRespondToProof } from "@/lib/orders/customer-flow";
import { OrderError } from "@/lib/orders/service";

export async function respondToProof(_: ActionResult, form: FormData): Promise<ActionResult> {
  const token = String(form.get("token") ?? "");
  const approve = form.get("decision") === "approve";
  return runAction(async () => {
    const business = await getRequestBusiness();
    if (!business || business.status !== "ACTIVE") throw new FormError("This link isn't available.");
    if (approve && form.get("agree") !== "on") throw new FormError("Tick the box to confirm");
    try {
      await customerRespondToProof(forBusiness(business.id), token, {
        approve,
        name: String(form.get("name") ?? ""),
        note: String(form.get("note") ?? ""),
        uploads: approve ? [] : formFiles(form, "files"),
        origin: await requestOrigin(),
      });
    } catch (e) {
      if (e instanceof OrderError || e instanceof UploadError) throw new FormError(e.message);
      throw e;
    }
    revalidatePath(`/proof/${token}`);
    return approve ? "Thank you! The artwork is approved." : "Thanks, we've got your changes and will send a new proof.";
  });
}
