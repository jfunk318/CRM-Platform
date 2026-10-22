import Link from "next/link";
import type { StaffRole } from "@prisma/client";
import { requireStaff } from "@/lib/auth/session";
import { getRequestBusiness } from "@/lib/business";
import { PLATFORM_NAME } from "@/lib/platform";
import { hasAnyRole } from "@/lib/auth/roles";
import { logout } from "../(auth)/login/actions";

export async function generateMetadata() {
  return { title: `Admin · ${(await getRequestBusiness())?.name ?? PLATFORM_NAME}` };
}

const NAV: { href: string; label: string; roles: StaffRole[] }[] = [
  { href: "/admin", label: "Dashboard", roles: [] },
  { href: "/admin/orders?type=ORDER", label: "Orders", roles: [] },
  { href: "/admin/orders?type=QUOTE", label: "Quotes", roles: ["SALES"] },
  { href: "/admin/customers", label: "Customers", roles: ["SALES"] },
  { href: "/admin/products", label: "Products", roles: ["SALES", "PURCHASING"] },
  { href: "/admin/categories", label: "Categories", roles: ["SALES"] },
  { href: "/admin/suppliers", label: "Suppliers", roles: ["PURCHASING"] },
  { href: "/admin/methods", label: "Decoration methods", roles: ["SALES", "PRODUCTION"] },
  { href: "/admin/pricing", label: "Pricing", roles: ["SALES"] },
  { href: "/admin/price-check", label: "Price check", roles: ["SALES"] },
  { href: "/admin/settings", label: "Shop & tax", roles: ["ADMIN"] },
  { href: "/admin/order-statuses", label: "Order statuses", roles: ["ADMIN"] },
  { href: "/admin/staff", label: "Staff", roles: ["ADMIN"] },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <aside className="border-b border-gray-200 bg-white md:min-h-screen md:w-56 md:border-r md:border-b-0">
        <div className="px-4 py-4 text-lg font-bold">
          {staff.business.name} <span className="text-amber-500">Admin</span>
        </div>
        <nav className="flex flex-wrap gap-1 px-2 pb-3 md:flex-col md:flex-nowrap">
          {NAV.filter((n) => hasAnyRole(staff.roles, n.roles)).map((n) => (
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
