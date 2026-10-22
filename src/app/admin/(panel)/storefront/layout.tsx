import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";

export default async function StorefrontAdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff(["SALES"]);
  const tabs = [
    { href: "/admin/storefront/items", label: "Shop items" },
    { href: "/admin/storefront/pages", label: "Pages" },
    ...(hasAnyRole(staff.roles, ["ADMIN"]) ? [{ href: "/admin/storefront", label: "Settings & payments" }] : []),
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Storefront</h1>
          <p className="text-sm text-gray-500">Your public website: what it sells, its pages, and how checkout works.</p>
        </div>
        <a href="/" target="_blank" className="btn-secondary">View the store ↗</a>
      </div>
      <nav className="flex gap-1 border-b border-gray-200 text-sm">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className="rounded-t-md px-3 py-2 hover:bg-amber-50">{t.label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
