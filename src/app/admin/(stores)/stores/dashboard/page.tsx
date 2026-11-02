import { requireStaff } from "@/lib/auth/session";
import { SectionDashboard } from "@/components/admin/dashboard/section-dashboard";

export const metadata = { title: "Web dashboard" };

/** The Web section's dashboard: affiliate stores and the main site. */
export default async function WebDashboard({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const staff = await requireStaff(["STORE_MANAGER"]);
  return <SectionDashboard staff={staff} section="web" title="Web" edit={(await searchParams).edit} />;
}
