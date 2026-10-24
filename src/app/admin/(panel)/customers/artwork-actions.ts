"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { type ActionResult, FormError, runAction, text } from "@/lib/admin/form";
import { formFiles, UploadError } from "@/lib/files/storage";
import { removeFromLibrary, uploadToLibrary } from "@/lib/design/library";
import { OrderError } from "@/lib/orders/service";

async function run(fn: () => Promise<string | void>): Promise<ActionResult> {
  return runAction(async () => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof OrderError || e instanceof UploadError) throw new FormError(e.message);
      throw e;
    }
  });
}

const refresh = () => {
  revalidatePath("/admin/customers/[id]", "page");
  revalidatePath("/admin/companies/[id]", "page");
};

/** Add images to a customer's (shared with their company) or a company's artwork. */
export async function uploadArtworkAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db, id: staffId } = await requireStaff(["SALES", "ARTWORK", "ARTWORK_MANAGER"]);
  return run(async () => {
    const customerId = String(form.get("customerId") ?? "") || null;
    const companyId = String(form.get("companyId") ?? "") || null;
    let owner;
    if (customerId) {
      const c = await db.customer.findUniqueOrThrow({ where: { id: customerId } });
      owner = { customerId: c.id, companyId: c.companyId };
    } else if (companyId) {
      owner = { customerId: null, companyId: (await db.company.findUniqueOrThrow({ where: { id: companyId } })).id };
    } else throw new FormError("Whose artwork is this?");
    const n = await uploadToLibrary(db, owner, formFiles(form, "files"), staffId);
    refresh();
    return `Added ${n} image${n === 1 ? "" : "s"}`;
  });
}

export async function removeArtworkAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["SALES", "ARTWORK", "ARTWORK_MANAGER"]);
  return run(async () => {
    await removeFromLibrary(db, text(form, "assetId"));
    refresh();
  });
}
