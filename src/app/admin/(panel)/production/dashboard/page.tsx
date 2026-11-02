import { requireStaff } from "@/lib/auth/session";
import { SectionDashboard } from "@/components/admin/dashboard/section-dashboard";

export const metadata = { title: "Production dashboard" };

/** The Production section's dashboard. */
export default async function ProductionDashboard({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const staff = await requireStaff(["PRODUCTION", "PURCHASING", "SHIPPING"]);
  return <SectionDashboard staff={staff} section="production" title="Production" edit={(await searchParams).edit} />;
}
