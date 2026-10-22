import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import type { Store } from "@prisma/client";

// Stores protected by an access code remember a shopper who entered it.
export const ACCESS_COOKIE = "store_access";
export const accessToken = (store: Pick<Store, "id" | "accessCode">) => createHash("sha256").update(`${store.id}:${store.accessCode}`).digest("hex");

export async function hasStoreAccess(store: Pick<Store, "id" | "accessCode">): Promise<boolean> {
  if (!store.accessCode) return true;
  return (await cookies()).get(ACCESS_COOKIE)?.value === accessToken(store);
}
