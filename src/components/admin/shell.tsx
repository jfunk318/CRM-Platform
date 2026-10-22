import Link from "next/link";
import type { StaffRole } from "@prisma/client";
import { hasAnyRole } from "@/lib/auth/roles";
import type { StaffContext } from "@/lib/auth/session";
import { PLATFORM_NAME } from "@/lib/platform";
import { logout } from "@/app/admin/(auth)/login/actions";

export type NavItem = { href: string; label: string; roles: StaffRole[] };
export type AdminArea = "business" | "stores";

/** Who can switch to the affiliate stores side of the back office. */
export const canManageStores = (roles: StaffRole[]) => hasAnyRole(roles, ["STORE_MANAGER"]);

/**
 * The back office frame: a switcher between the business admin and the
 * affiliate stores area (for store managers and admins), and the left menu
 * for whichever area is open.
 */
export function AdminShell({ staff, area, nav, children }: { staff: StaffContext; area: AdminArea; nav: NavItem[]; children: React.ReactNode }) {
  const switcher = canManageStores(staff.roles);
  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <aside className="border-b border-gray-200 bg-white md:min-h-screen md:w-56 md:border-r md:border-b-0">
        <div className="px-4 pt-4 pb-3 text-lg font-bold">
          {staff.business.name} <span className="text-amber-500">Admin</span>
        </div>
        {switcher && (
          <div className="mx-3 mb-3 grid grid-cols-2 rounded-md bg-gray-100 p-0.5 text-center text-xs font-medium" data-testid="area-switcher">
            <Link href="/admin" className={`rounded px-2 py-1.5 ${area === "business" ? "bg-white shadow-sm" : "text-gray-600 hover:text-gray-900"}`}>
              Business
            </Link>
            <Link href="/admin/stores" className={`rounded px-2 py-1.5 ${area === "stores" ? "bg-white shadow-sm" : "text-gray-600 hover:text-gray-900"}`}>
              Affiliate stores
            </Link>
          </div>
        )}
        <nav className="flex flex-wrap gap-1 px-2 pb-3 md:flex-col md:flex-nowrap" aria-label={area === "stores" ? "Affiliate stores" : "Business admin"}>
          {nav.filter((n) => hasAnyRole(staff.roles, n.roles)).map((n) => (
            <Link key={n.href} href={n.href} className="rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-amber-50">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
          <div className="truncate font-medium text-gray-700">{staff.name}</div>
          <div className="truncate">{staff.email}</div>
          <Link href="/admin/account" className="mt-1 block text-amber-700 hover:underline">My account</Link>
          <form action={logout} className="mt-2">
            <button className="text-amber-700 hover:underline">Sign out</button>
          </form>
        </div>
        <div className="px-4 pb-4 text-[11px] text-gray-400">Powered by {PLATFORM_NAME}</div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
