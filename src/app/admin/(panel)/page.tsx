import { requireStaff } from "@/lib/auth/session";
import { SectionDashboard } from "@/components/admin/dashboard/section-dashboard";

/** The Sales dashboard (the back office's home). */
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string; edit?: string }> }) {
  const staff = await requireStaff();
  const { denied, edit } = await searchParams;
  return (
    <>
      {denied && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          You don&apos;t have access to that page. Ask an admin to add the role you need.
        </p>
      )}
      <SectionDashboard staff={staff} section="sales" edit={edit} />
    </>
  );
}
