import { requireStaff } from "@/lib/auth/session";
import { getRequestBusiness } from "@/lib/business";
import { PLATFORM_NAME } from "@/lib/platform";
import { AdminShell, type NavItem } from "@/components/admin/shell";

export async function generateMetadata() {
  return { title: `Admin · ${(await getRequestBusiness())?.name ?? PLATFORM_NAME}` };
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", roles: [] },
  { href: "/admin/tasks", label: "Tasks", roles: [], tasks: true },
  { href: "/admin/orders?type=ORDER", label: "Orders", roles: [] },
  { href: "/admin/orders?type=QUOTE", label: "Quotes", roles: ["SALES"] },
  { href: "/admin/production", label: "Production", roles: ["PRODUCTION"] },
  { href: "/admin/purchasing", label: "Purchasing", roles: ["PURCHASING"] },
  { href: "/admin/inventory", label: "Inventory", roles: ["PURCHASING"] },
  { href: "/admin/shipping", label: "Shipping", roles: ["SHIPPING"] },
  { href: "/admin/leads", label: "Leads", roles: ["SALES"] },
  { href: "/admin/customers", label: "Customers", roles: ["SALES"] },
  { href: "/admin/products", label: "Products", roles: ["SALES", "PURCHASING"] },
  { href: "/admin/categories", label: "Categories", roles: ["SALES"] },
  { href: "/admin/suppliers", label: "Suppliers", roles: ["PURCHASING"] },
  { href: "/admin/methods", label: "Decoration methods", roles: ["SALES", "PRODUCTION"] },
  { href: "/admin/pricing", label: "Pricing", roles: ["SALES"] },
  { href: "/admin/price-check", label: "Price check", roles: ["SALES"] },
  { href: "/admin/settings", label: "Shop & tax", roles: ["ADMIN"] },
  { href: "/admin/order-statuses", label: "Order statuses", roles: ["ADMIN"] },
  { href: "/admin/delivery-methods", label: "Delivery methods", roles: ["ADMIN"] },
  { href: "/admin/staff", label: "Staff", roles: ["ADMIN"] },
];

/** The business admin: CRM, orders, production, purchasing, shipping, catalog. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  return (
    <AdminShell staff={staff} area="business" nav={NAV}>
      {children}
    </AdminShell>
  );
}
