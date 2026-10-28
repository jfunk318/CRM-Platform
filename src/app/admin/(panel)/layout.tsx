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
  { href: "/admin/leads", label: "Leads", roles: ["SALES"], group: "Sales" },
  { href: "/admin/pipeline", label: "Pipeline", roles: ["SALES"], group: "Sales" },
  { href: "/admin/orders?type=QUOTE", label: "Quotes", roles: ["SALES"], group: "Sales" },
  { href: "/admin/customers", label: "Customers", roles: ["SALES"], group: "Sales" },
  { href: "/admin/orders?type=ORDER", label: "Orders", roles: [], group: "Orders" },
  { href: "/admin/production", label: "Production", roles: ["PRODUCTION"], group: "Orders" },
  { href: "/admin/shipping", label: "Shipping", roles: ["SHIPPING"], group: "Orders" },
  { href: "/admin/purchasing", label: "Purchasing", roles: ["PURCHASING"], group: "Purchasing" },
  { href: "/admin/inventory", label: "Inventory", roles: ["PURCHASING"], group: "Purchasing" },
  { href: "/admin/suppliers", label: "Suppliers", roles: ["PURCHASING"], group: "Purchasing" },
  { href: "/admin/products", label: "Products", roles: ["SALES", "PURCHASING"], group: "Catalog" },
  { href: "/admin/categories", label: "Categories", roles: ["SALES"], group: "Catalog" },
  { href: "/admin/methods", label: "Decoration methods", roles: ["SALES", "PRODUCTION"], group: "Catalog" },
  { href: "/admin/pricing", label: "Pricing", roles: ["SALES"], group: "Catalog" },
  { href: "/admin/price-check", label: "Price check", roles: ["SALES"], group: "Catalog" },
  { href: "/admin/settings", label: "Shop & tax", roles: ["ADMIN"], group: "Settings" },
  { href: "/admin/order-statuses", label: "Order statuses", roles: ["ADMIN"], group: "Settings" },
  { href: "/admin/delivery-methods", label: "Delivery methods", roles: ["ADMIN"], group: "Settings" },
  { href: "/admin/automations", label: "Automations", roles: ["ADMIN"], group: "Settings" },
  { href: "/admin/staff", label: "Staff", roles: ["ADMIN"], group: "Settings" },
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
