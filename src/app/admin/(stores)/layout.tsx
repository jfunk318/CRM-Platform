import { requireStaff } from "@/lib/auth/session";
import { getRequestBusiness } from "@/lib/business";
import { PLATFORM_NAME } from "@/lib/platform";
import { AdminShell, type NavItem } from "@/components/admin/shell";

export async function generateMetadata() {
  return { title: `Affiliate stores · ${(await getRequestBusiness())?.name ?? PLATFORM_NAME}` };
}

const NAV: NavItem[] = [
  { href: "/admin/stores", label: "All stores", roles: [], requests: true },
  { href: "/admin/stores/groups", label: "Store groups", roles: [] },
  { href: "/admin/stores/main-site", label: "Main site", roles: [] },
  { href: "/admin/stores/promo-codes", label: "Promo codes", roles: [] },
  { href: "/admin/stores/gift-codes", label: "Gift codes", roles: [] },
  { href: "/admin/stores/settings", label: "Defaults & payments", roles: ["ADMIN"] },
];

/** The affiliate stores area: only store managers (and admins) get in. */
export default async function StoresLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff(["STORE_MANAGER"]);
  return (
    <AdminShell staff={staff} area="stores" nav={NAV}>
      {children}
    </AdminShell>
  );
}
