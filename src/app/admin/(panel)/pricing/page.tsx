import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { toPercentInput } from "@/lib/admin/form";
import { ActionForm } from "@/components/admin/action-form";
import { RowsEditor } from "@/components/admin/rows-editor";
import {
  createPricingGroup,
  createQuantityDiscount,
  deletePricingGroup,
  deleteQuantityDiscount,
  savePricingGroup,
  saveQuantityDiscount,
} from "./actions";

const tierColumns = [
  { name: "costFrom", label: "Wholesale cost from", placeholder: "0.00", suffix: "$" },
  { name: "costTo", label: "to (blank = no limit)", placeholder: "no limit", suffix: "$" },
  { name: "pct", label: "Markup", placeholder: "40", suffix: "%" },
];
const discountColumns = [
  { name: "minQty", label: "From quantity", placeholder: "12" },
  { name: "pct", label: "Discount", placeholder: "5", suffix: "%" },
];

export default async function PricingPage() {
  const staff = await requireStaff(["SALES"]);
  const isAdmin = hasAnyRole(staff.roles, ["ADMIN"]);
  const [groups, discounts] = await Promise.all([
    db.pricingGroup.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      include: { markupTiers: { orderBy: { costFrom: "asc" } } },
    }),
    db.quantityDiscount.findMany({
      orderBy: { name: "asc" },
      include: { tiers: { orderBy: { minQty: "asc" } }, _count: { select: { products: true } } },
    }),
  ]);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h1 className="page-title">Garment pricing</h1>
          <p className="text-sm text-gray-500">
            Blank garment price = wholesale cost plus markup. Pricing groups let specific customers or stores
            have their own markups and decoration prices.
          </p>
        </div>
        {groups.map((g) => (
          <div key={g.id} className="card space-y-3">
            <ActionForm action={savePricingGroup}>
              <input type="hidden" name="id" value={g.id} />
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor={`name-${g.id}`}>Group name</label>
                  <input className="input" id={`name-${g.id}`} name="name" defaultValue={g.name} required />
                </div>
                <div>
                  <label className="label" htmlFor={`mode-${g.id}`}>Markup is calculated as</label>
                  <select className="input" id={`mode-${g.id}`} name="markupMode" defaultValue={g.markupMode}>
                    <option value="MARKUP">Markup: cost × (1 + %)</option>
                    <option value="MARGIN">Margin: cost ÷ (1 − %)</option>
                  </select>
                </div>
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <input type="checkbox" name="isDefault" defaultChecked={g.isDefault} /> Default group
                </label>
              </div>
              <RowsEditor
                columns={tierColumns}
                addLabel="Add tier"
                initialRows={g.markupTiers.map((t) => ({
                  costFrom: t.costFrom.toFixed(2),
                  costTo: t.costTo?.toFixed(2) ?? "",
                  pct: toPercentInput(t.pct),
                }))}
              />
            </ActionForm>
            {isAdmin && !g.isDefault && (
              <ActionForm action={deletePricingGroup} submitLabel="Delete group" danger confirm={`Delete ${g.name}?`}>
                <input type="hidden" name="id" value={g.id} />
              </ActionForm>
            )}
          </div>
        ))}
        <div className="card">
          <ActionForm action={createPricingGroup} submitLabel="Add pricing group" className="flex flex-wrap items-end gap-3">
            <div className="min-w-60 flex-1">
              <label className="label" htmlFor="new-group">New pricing group</label>
              <input className="input" id="new-group" name="name" placeholder="e.g. Wholesale, Schools" required />
            </div>
          </ActionForm>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="page-title">Quantity discounts</h2>
          <p className="text-sm text-gray-500">
            Percent off garment + decoration once a line reaches a quantity. Assign a table to products in the
            product editor.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {discounts.map((d) => (
            <div key={d.id} className="card space-y-3">
              <ActionForm action={saveQuantityDiscount}>
                <input type="hidden" name="id" value={d.id} />
                <div>
                  <label className="label" htmlFor={`dname-${d.id}`}>Name</label>
                  <input className="input" id={`dname-${d.id}`} name="name" defaultValue={d.name} required />
                </div>
                <RowsEditor
                  columns={discountColumns}
                  addLabel="Add break"
                  initialRows={d.tiers.map((t) => ({ minQty: String(t.minQty), pct: toPercentInput(t.pct) }))}
                />
                <p className="text-xs text-gray-500">Used by {d._count.products} product(s)</p>
              </ActionForm>
              <ActionForm action={deleteQuantityDiscount} submitLabel="Delete" danger confirm={`Delete ${d.name}?`}>
                <input type="hidden" name="id" value={d.id} />
              </ActionForm>
            </div>
          ))}
          <div className="card">
            <ActionForm action={createQuantityDiscount} submitLabel="Add discount table">
              <div>
                <label className="label" htmlFor="new-discount">New discount table</label>
                <input className="input" id="new-discount" name="name" placeholder="e.g. Team orders" required />
              </div>
              <RowsEditor columns={discountColumns} addLabel="Add break" initialRows={[{ minQty: "", pct: "" }]} />
            </ActionForm>
          </div>
        </div>
      </section>
    </div>
  );
}
