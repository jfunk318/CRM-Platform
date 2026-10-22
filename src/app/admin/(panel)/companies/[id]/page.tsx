import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { ActionForm } from "@/components/admin/action-form";
import { OrderTable, orderTableInclude } from "@/components/admin/order-table";
import { saveCompany } from "../../customers/actions";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff(["SALES"]);
  const { id } = await params;
  const [company, groups] = await Promise.all([
    db.company.findUnique({
      where: { id },
      include: {
        customers: { orderBy: [{ lastName: "asc" }, { firstName: "asc" }] },
        orders: { orderBy: { createdAt: "desc" }, include: orderTableInclude },
      },
    }),
    db.pricingGroup.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
  ]);
  if (!company) notFound();

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/customers" className="text-sm text-amber-700 hover:underline">← Customers</Link>
        <h1 className="page-title mt-1">{company.name}</h1>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">Contacts</h2>
        <div className="card p-2">
          {company.customers.length === 0 && <p className="p-2 text-sm text-gray-500">No contacts.</p>}
          <ul className="divide-y divide-gray-100">
            {company.customers.map((c) => (
              <li key={c.id} className="flex flex-wrap gap-x-4 px-2 py-2 text-sm">
                <Link href={`/admin/customers/${c.id}`} className="font-medium text-amber-700 hover:underline">
                  {c.firstName} {c.lastName}
                </Link>
                <span className="text-gray-600">{c.email}</span>
                <span className="text-gray-600">{c.phone}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Quotes &amp; orders</h2>
        <OrderTable orders={company.orders} empty="None yet." />
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">Details</h2>
        <ActionForm action={saveCompany}>
          <input type="hidden" name="id" value={company.id} />
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="name">Name</label>
              <input className="input" id="name" name="name" defaultValue={company.name} required />
            </div>
            <div>
              <label className="label" htmlFor="phone">Phone</label>
              <input className="input" id="phone" name="phone" defaultValue={company.phone ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="website">Website</label>
              <input className="input" id="website" name="website" defaultValue={company.website ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="pricingGroupId">Pricing group</label>
              <select className="input" id="pricingGroupId" name="pricingGroupId" defaultValue={company.pricingGroupId ?? ""}>
                <option value="">Default</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" name="taxExempt" defaultChecked={company.taxExempt} /> Tax exempt
            </label>
          </div>
          <div>
            <label className="label" htmlFor="notes">Notes (staff only)</label>
            <textarea className="input min-h-20" id="notes" name="notes" defaultValue={company.notes ?? ""} />
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
