import "server-only";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { storeUrlHere } from "@/lib/business";
import { storeStatus } from "./settings";

/** A store for its back-office dashboard (store managers and admins only). */
export async function loadAdminStore(id: string) {
  const staff = await requireStaff(["STORE_MANAGER"]);
  const store = await staff.db.store.findUnique({
    where: { id },
    include: { group: true, manager: { select: { id: true, name: true } }, customer: true, deliveryMethods: true },
  });
  if (!store) notFound();
  return { staff, db: staff.db, store, status: storeStatus(store), url: await storeUrlHere(store.slug) };
}
