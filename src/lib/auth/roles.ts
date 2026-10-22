import type { StaffRole } from "@prisma/client";

export const ROLE_LABELS: Record<StaffRole, string> = {
  ADMIN: "Admin",
  SALES: "Sales",
  ARTWORK: "Artwork",
  ARTWORK_MANAGER: "Artwork manager",
  PRODUCTION: "Production",
  PURCHASING: "Purchasing",
  SHIPPING: "Shipping",
  REFUNDS: "Refunds",
  STORE_MANAGER: "Store manager",
};

export const ALL_ROLES = Object.keys(ROLE_LABELS) as StaffRole[];

/** Admins can do everything; otherwise the user needs one of the listed roles. */
export function hasAnyRole(userRoles: StaffRole[], required: StaffRole[]): boolean {
  if (userRoles.includes("ADMIN")) return true;
  if (required.length === 0) return true;
  return required.some((r) => userRoles.includes(r));
}
