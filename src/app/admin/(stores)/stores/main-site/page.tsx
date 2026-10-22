import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";

/** The business's own site is managed like any store. */
export default async function MainSite() {
  const { db } = await requireStaff(["STORE_MANAGER"]);
  const root = await db.store.findFirstOrThrow({ where: { kind: "ROOT" } });
  redirect(`/admin/stores/${root.id}`);
}
