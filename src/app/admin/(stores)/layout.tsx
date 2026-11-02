import { requireStaff } from "@/lib/auth/session";
import { getRequestBusiness } from "@/lib/business";
import { PLATFORM_NAME } from "@/lib/platform";
import { AdminShell } from "@/components/admin/shell";

export async function generateMetadata() {
  return { title: `Affiliate stores · ${(await getRequestBusiness())?.name ?? PLATFORM_NAME}` };
}

/** The affiliate stores area: only store managers (and admins) get in. */
export default async function StoresLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff(["STORE_MANAGER"]);
  return (
    <AdminShell staff={staff}>
      {children}
    </AdminShell>
  );
}
