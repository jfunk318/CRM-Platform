import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { ActionForm } from "@/components/admin/action-form";
import { CompanyPicker } from "@/components/admin/company-picker";
import { OrderTable, orderTableInclude } from "@/components/admin/order-table";
import { RowsEditor } from "@/components/admin/rows-editor";
import { ArtworkLibrary } from "@/components/admin/artwork-library";
import { libraryFor } from "@/lib/design/library";
import { saveAddresses, saveCustomer, startOrder } from "../actions";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { db } = await requireStaff(["SALES"]);
  const { id } = await params;
  const [customer, companies, groups] = await Promise.all([
    db.customer.findUnique({
      where: { id },
      include: {
        company: { include: { pricingGroup: true } },
        addresses: { orderBy: { isDefault: "desc" } },
        orders: { orderBy: { createdAt: "desc" }, include: orderTableInclude },
      },
    }),
    db.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.pricingGroup.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
  ]);
  if (!customer) notFound();
  const artwork = await libraryFor(db, { customerId: customer.id, companyId: customer.companyId });
  const quotes = customer.orders.filter((o) => o.type === "QUOTE");
  const orders = customer.orders.filter((o) => o.type === "ORDER");
  const inheritedGroup = customer.company?.pricingGroup?.name ?? groups.find((g) => g.isDefault)?.name ?? "default";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/customers" className="text-sm text-amber-700 hover:underline">← Customers</Link>
          <h1 className="page-title mt-1">{customer.firstName} {customer.lastName}</h1>
          {customer.company && (
            <Link href={`/admin/companies/${customer.company.id}`} className="text-sm text-gray-600 hover:underline">
              {customer.company.name}
            </Link>
          )}
        </div>
        <div className="flex gap-2">
          <ActionForm action={startOrder} submitLabel="New quote" className="flex">
            <input type="hidden" name="customerId" value={customer.id} />
            <input type="hidden" name="type" value="QUOTE" />
          </ActionForm>
          <ActionForm action={startOrder} submitLabel="New order" className="flex">
            <input type="hidden" name="customerId" value={customer.id} />
            <input type="hidden" name="type" value="ORDER" />
          </ActionForm>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">Quotes</h2>
        <OrderTable orders={quotes} empty="No quotes yet." />
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold">Orders</h2>
        <OrderTable orders={orders} empty="No orders yet." />
      </section>

      <ArtworkLibrary assets={artwork} owner={{ customerId: customer.id }} sharedWith={customer.company?.name} />

      <section className="card">
        <h2 className="mb-3 font-semibold">Details</h2>
        <ActionForm action={saveCustomer}>
          <input type="hidden" name="id" value={customer.id} />
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="First name" name="firstName" value={customer.firstName} required />
            <Field label="Last name" name="lastName" value={customer.lastName} />
            <Field label="Email" name="email" value={customer.email ?? ""} />
            <Field label="Phone" name="phone" value={customer.phone ?? ""} />
          </div>
          <CompanyPicker companies={companies} value={customer.companyId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="pricingGroupId">Pricing group</label>
              <select className="input" id="pricingGroupId" name="pricingGroupId" defaultValue={customer.pricingGroupId ?? ""}>
                <option value="">Same as company ({inheritedGroup})</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="taxExempt">Tax exempt</label>
              <select
                className="input"
                id="taxExempt"
                name="taxExempt"
                defaultValue={customer.taxExempt === null ? "inherit" : customer.taxExempt ? "yes" : "no"}
              >
                <option value="inherit">Same as company ({customer.company?.taxExempt ? "exempt" : "taxable"})</option>
                <option value="yes">Exempt</option>
                <option value="no">Taxable</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="notes">Notes (staff only)</label>
            <textarea className="input min-h-20" id="notes" name="notes" defaultValue={customer.notes ?? ""} />
          </div>
        </ActionForm>
      </section>

      <section className="card">
        <h2 className="font-semibold">Addresses</h2>
        <p className="mb-3 text-sm text-gray-500">The default address is used as the ship-to on new quotes and orders.</p>
        <ActionForm action={saveAddresses}>
          <input type="hidden" name="customerId" value={customer.id} />
          <RowsEditor
            addLabel="Add address"
            columns={[
              { name: "addressId", label: "", type: "hidden" },
              { name: "label", label: "Label", placeholder: "Office", width: "7rem" },
              { name: "name", label: "Ship to name" },
              { name: "line1", label: "Street" },
              { name: "line2", label: "Apt / suite" },
              { name: "city", label: "City" },
              { name: "region", label: "State", width: "5rem" },
              { name: "postalCode", label: "ZIP", width: "6rem" },
              { name: "country", label: "Country", width: "5rem" },
              { name: "isDefault", label: "Default", type: "checkbox" },
            ]}
            initialRows={customer.addresses.map((a) => ({
              addressId: a.id,
              label: a.label ?? "",
              name: a.name,
              line1: a.line1,
              line2: a.line2 ?? "",
              city: a.city,
              region: a.region,
              postalCode: a.postalCode,
              country: a.country,
              isDefault: a.isDefault,
            }))}
          />
        </ActionForm>
      </section>
    </div>
  );
}

function Field({ label, name, value, required }: { label: string; name: string; value: string; required?: boolean }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input className="input" id={name} name={name} defaultValue={value} required={required} />
    </div>
  );
}
