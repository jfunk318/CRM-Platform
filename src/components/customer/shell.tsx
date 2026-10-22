import type { Business } from "@prisma/client";

/** Page frame for customer-facing pages, branded as the business. */
export function CustomerShell({ business, children }: { business: Business; children: React.ReactNode }) {
  const address = [business.addressLine1, business.addressLine2, [business.city, business.region].filter(Boolean).join(", "), business.postalCode]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-4">
          <div className="text-lg font-bold">{business.name}</div>
          <div className="text-right text-xs text-gray-500">
            {[business.email, business.phone].filter(Boolean).join(" · ")}
            {address && <div>{address}</div>}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 print:py-2">{children}</main>
    </div>
  );
}
