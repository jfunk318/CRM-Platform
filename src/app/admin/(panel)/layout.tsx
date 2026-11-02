import { requireStaff } from "@/lib/auth/session";
import { getRequestBusiness } from "@/lib/business";
import { PLATFORM_NAME } from "@/lib/platform";
import { AdminShell } from "@/components/admin/shell";

export async function generateMetadata() {
  return { title: `Admin · ${(await getRequestBusiness())?.name ?? PLATFORM_NAME}` };
}

/** The business admin: CRM, orders, production, purchasing, shipping, catalog. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  return (
    <AdminShell staff={staff}>
      {children}
    </AdminShell>
  );
}
