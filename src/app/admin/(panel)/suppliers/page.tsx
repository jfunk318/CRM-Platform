import type { Supplier } from "@prisma/client";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { ActionForm } from "@/components/admin/action-form";
import { saveSupplier } from "./actions";

const INTEGRATION_LABELS = {
  REST_API: "Supplier API",
  PROMOSTANDARDS: "PromoStandards",
  CSV: "Spreadsheet upload",
  MANUAL: "Entered by hand",
} as const;

export default async function SuppliersPage() {
  const { db } = await requireStaff(["PURCHASING"]);
  const suppliers = await db.supplier.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Suppliers</h1>
        <p className="text-sm text-gray-500">
          Where blanks come from. Purchase orders are emailed to the address here. Live catalog and ordering
          connections for SanMar and S&amp;S come with the integrations phase; until then products are entered by hand.
        </p>
      </div>
      <Link href="/admin/suppliers/import" className="card block border-dashed hover:border-amber-300">
        <div className="font-medium text-amber-700">Import a supplier catalog file →</div>
        <div className="text-sm text-gray-500">Load SanMar&apos;s product data (products, colors, sizes, your costs and photos).</div>
      </Link>
      {suppliers.map((s) => (
        <div key={s.id} className="card">
          <ActionForm action={saveSupplier} className="grid gap-3 sm:grid-cols-5 sm:items-end">
            <input type="hidden" name="id" value={s.id} />
            <SupplierFields supplier={s} />
            <div className="text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="active" defaultChecked={s.active} /> Active
              </label>
              <Link href={`/admin/products?supplier=${s.id}`} className="text-xs text-amber-700 hover:underline">
                {s._count.products} product(s)
              </Link>
            </div>
          </ActionForm>
        </div>
      ))}
      <div className="card">
        <h2 className="mb-2 font-semibold">Add a supplier</h2>
        <ActionForm action={saveSupplier} submitLabel="Add supplier" resetOnSuccess className="grid gap-3 sm:grid-cols-5 sm:items-end">
          <SupplierFields />
        </ActionForm>
      </div>
    </div>
  );
}

function SupplierFields({ supplier }: { supplier?: Supplier }) {
  const k = supplier?.id ?? "new";
  return (
    <>
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`sn-${k}`}>Name</label>
        <input className="input" id={`sn-${k}`} name="name" defaultValue={supplier?.name} required />
      </div>
      <div>
        <label className="label" htmlFor={`sc-${k}`}>Code</label>
        <input className="input" id={`sc-${k}`} name="code" defaultValue={supplier?.code} placeholder="from name" />
      </div>
      <div>
        <label className="label" htmlFor={`si-${k}`}>Catalog loaded by</label>
        <select className="input" id={`si-${k}`} name="integration" defaultValue={supplier?.integration ?? "MANUAL"}>
          {Object.entries(INTEGRATION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`se-${k}`}>Email for purchase orders</label>
        <input className="input" id={`se-${k}`} name="email" type="email" defaultValue={supplier?.email ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor={`sp-${k}`}>Phone</label>
        <input className="input" id={`sp-${k}`} name="phone" defaultValue={supplier?.phone ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor={`sa-${k}`}>Our account #</label>
        <input className="input" id={`sa-${k}`} name="accountNumber" defaultValue={supplier?.accountNumber ?? ""} />
      </div>
      <div className="sm:col-span-5">
        <label className="label" htmlFor={`sno-${k}`}>Notes (staff only)</label>
        <input className="input" id={`sno-${k}`} name="notes" defaultValue={supplier?.notes ?? ""} placeholder="e.g. cutoff 3pm for same-day shipping" />
      </div>
    </>
  );
}
