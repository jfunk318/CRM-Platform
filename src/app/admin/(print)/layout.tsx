import { requireStaff } from "@/lib/auth/session";
import { PrintButton } from "@/components/customer/print-button";

/** Paper documents for the shop: work orders, packing slips, purchase orders. */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-4xl px-6 py-6 print:max-w-none print:p-0">
        <div className="no-print mb-4 flex justify-end">
          <PrintButton />
        </div>
        {children}
      </div>
    </div>
  );
}
