import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { blankUnitPrice } from "@/lib/pricing";
import { ActionForm } from "@/components/admin/action-form";
import { RowsEditor } from "@/components/admin/rows-editor";
import {
  deleteProduct,
  saveColors,
  saveCosts,
  saveMethodRules,
  saveProductDetails,
  saveSizes,
  saveViewDetails,
  saveViews,
} from "../actions";

const SHADE_OPTIONS = [
  { value: "LIGHT", label: "Light" },
  { value: "DARK", label: "Dark (needs underbase)" },
  { value: "WHITE", label: "White" },
];
const pct = (n: number) => String(Math.round(n * 1000) / 10);

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff(["SALES", "PURCHASING"]);
  const { id } = await params;
  const [product, suppliers, types, categories, discounts, pricing] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: {
        colors: { orderBy: { sortOrder: "asc" } },
        sizes: { orderBy: { sortOrder: "asc" } },
        variants: true,
        categories: true,
        views: { orderBy: { sortOrder: "asc" }, include: { areas: true, images: true } },
        methodRules: true,
        productType: { include: { decorationMethods: { include: { method: true } } } },
      },
    }),
    db.supplier.findMany({ orderBy: { name: "asc" } }),
    db.productType.findMany({ orderBy: { name: "asc" } }),
    db.category.findMany({ orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }] }),
    db.quantityDiscount.findMany({ orderBy: { name: "asc" } }),
    db.pricingGroup.findFirst({ where: { isDefault: true }, include: { markupTiers: true } }),
  ]);
  if (!product) notFound();

  const retail = (cost: { toString(): string }) => {
    if (!pricing) return null;
    try {
      return blankUnitPrice(cost.toString(), pricing.markupTiers, pricing.markupMode).toFixed(2);
    } catch {
      return null;
    }
  };
  const variant = (colorId: string, sizeId: string) =>
    product.variants.find((v) => v.colorId === colorId && v.sizeId === sizeId);
  const methods = product.productType.decorationMethods.map((d) => d.method).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/products" className="text-sm text-amber-700 hover:underline">← Products</Link>
        <h1 className="page-title mt-1">{product.name}</h1>
        <p className="text-sm text-gray-500">
          {product.styleCode} · {product.colors.length} colors · {product.sizes.length} sizes · {product.variants.length} SKUs
        </p>
      </div>

      <Section title="Details">
        <ActionForm action={saveProductDetails}>
          <input type="hidden" name="id" value={product.id} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name" name="name" value={product.name} required />
            <Field label="Style code" name="styleCode" value={product.styleCode} required />
            <Field label="Brand" name="brand" value={product.brand ?? ""} />
            <Field label="URL slug" name="slug" value={product.slug} />
            <Select label="Supplier" name="supplierId" value={product.supplierId ?? ""}>
              <option value="">In-house / custom</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Select label="Product type" name="productTypeId" value={product.productTypeId}>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
            <Select label="Status" name="status" value={product.status}>
              <option value="ACTIVE">Active</option>
              <option value="CLOSING_OUT">Closing out</option>
              <option value="DISCONTINUED">Discontinued</option>
            </Select>
            <Select label="Quantity discount" name="quantityDiscountId" value={product.quantityDiscountId ?? ""}>
              <option value="">None</option>
              {discounts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
            <Field label="Production lead days (blank = method default)" name="productionLeadDays" value={product.productionLeadDays?.toString() ?? ""} />
            <Field label="Size chart image link" name="sizeChartImageUrl" value={product.sizeChartImageUrl ?? ""} />
            <Field label="Spec sheet link" name="specSheetUrl" value={product.specSheetUrl ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="description">Description</label>
            <textarea className="input min-h-24" id="description" name="description" defaultValue={product.description ?? ""} />
          </div>
          <fieldset>
            <legend className="label">Categories</legend>
            <div className="grid gap-1 text-sm sm:grid-cols-3">
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="categoryIds"
                    value={c.id}
                    defaultChecked={product.categories.some((pc) => pc.categoryId === c.id)}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-5 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="allowBlankSale" defaultChecked={product.allowBlankSale} /> Can be sold blank
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="isCustom" defaultChecked={product.isCustom} /> In-house / custom product
            </label>
          </div>
        </ActionForm>
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Colors" hint="Dark garments get a white underbase for screen printing.">
          <ActionForm action={saveColors}>
            <input type="hidden" name="productId" value={product.id} />
            <RowsEditor
              addLabel="Add color"
              columns={[
                { name: "colorId", label: "", type: "hidden" },
                { name: "name", label: "Name", placeholder: "Heather Navy" },
                { name: "hex", label: "Hex", placeholder: "#1F2A44", width: "8rem" },
                { name: "shade", label: "Shade", type: "select", options: SHADE_OPTIONS },
              ]}
              initialRows={product.colors.map((c) => ({ colorId: c.id, name: c.name, hex: c.hex ?? "", shade: c.shade }))}
            />
          </ActionForm>
        </Section>
        <Section title="Sizes" hint="In display order.">
          <ActionForm action={saveSizes}>
            <input type="hidden" name="productId" value={product.id} />
            <RowsEditor
              addLabel="Add size"
              columns={[
                { name: "sizeId", label: "", type: "hidden" },
                { name: "code", label: "Code", placeholder: "2XL" },
                { name: "label", label: "Label (optional)", placeholder: "2X-Large" },
              ]}
              initialRows={product.sizes.map((s) => ({ sizeId: s.id, code: s.code, label: s.label }))}
            />
          </ActionForm>
        </Section>
      </div>

      <Section
        title="Wholesale costs & stock"
        hint={`Leave a cost blank if that color/size isn't offered. Retail shown is blank garment price at the ${pricing?.name ?? "default"} markup.`}
      >
        {product.colors.length === 0 || product.sizes.length === 0 ? (
          <p className="text-sm text-gray-500">Add colors and sizes first.</p>
        ) : (
          <ActionForm action={saveCosts}>
            <input type="hidden" name="productId" value={product.id} />
            <div className="overflow-x-auto">
              <table className="text-sm">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left text-xs text-gray-500">Color</th>
                    {product.sizes.map((s) => (
                      <th key={s.id} className="px-2 py-1 text-left text-xs text-gray-500">{s.code}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {product.colors.map((c) => (
                    <tr key={c.id} className="border-t border-gray-100">
                      <td className="px-2 py-2 align-top whitespace-nowrap">
                        <span className="mr-1 inline-block h-3 w-3 rounded-full border align-middle" style={{ background: c.hex ?? "#fff" }} />
                        {c.name}
                      </td>
                      {product.sizes.map((s) => {
                        const v = variant(c.id, s.id);
                        const key = `${c.id}_${s.id}`;
                        return (
                          <td key={s.id} className="px-1 py-1 align-top">
                            <input
                              className="input w-20"
                              name={`cost_${key}`}
                              aria-label={`${c.name} ${s.code} cost`}
                              defaultValue={v?.wholesaleCost.toFixed(2) ?? ""}
                              placeholder="—"
                            />
                            <input
                              className="input mt-1 w-20 text-xs"
                              name={`stock_${key}`}
                              aria-label={`${c.name} ${s.code} stock`}
                              defaultValue={v?.stockOnHand?.toString() ?? ""}
                              placeholder="stock"
                            />
                            <input type="hidden" name={`ssku_${key}`} value={v?.supplierSku ?? ""} />
                            {v && <div className="mt-0.5 text-xs text-gray-500">${retail(v.wholesaleCost) ?? "?"}</div>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ActionForm>
        )}
      </Section>

      <Section title="Views & print areas" hint="Views are the sides customers can decorate. Print areas are where artwork can go.">
        <ActionForm action={saveViews}>
          <input type="hidden" name="productId" value={product.id} />
          <RowsEditor
            addLabel="Add view"
            columns={[
              { name: "viewId", label: "", type: "hidden" },
              { name: "name", label: "View", placeholder: "Front" },
            ]}
            initialRows={product.views.map((v) => ({ viewId: v.id, name: v.name }))}
          />
        </ActionForm>
        {product.views.map((view) => {
          const preview = view.images[0]?.url;
          return (
            <div key={view.id} className="mt-4 rounded-md border border-gray-200 p-3">
              <h3 className="mb-2 font-medium">{view.name}</h3>
              <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                <ActionForm action={saveViewDetails}>
                  <input type="hidden" name="viewId" value={view.id} />
                  <p className="text-xs text-gray-500">
                    Size is the largest printable area in inches. Position is the box on the product photo, in % of the
                    photo&apos;s width and height.
                  </p>
                  <RowsEditor
                    addLabel="Add print area"
                    columns={[
                      { name: "name", label: "Area", placeholder: "Full Front", width: "11rem" },
                      { name: "widthIn", label: "Width", suffix: "in" },
                      { name: "heightIn", label: "Height", suffix: "in" },
                      { name: "x", label: "Left", suffix: "%" },
                      { name: "y", label: "Top", suffix: "%" },
                      { name: "w", label: "Box W", suffix: "%" },
                      { name: "h", label: "Box H", suffix: "%" },
                    ]}
                    initialRows={view.areas.map((a) => ({
                      name: a.name,
                      widthIn: a.widthIn.toString(),
                      heightIn: a.heightIn.toString(),
                      x: pct(a.x),
                      y: pct(a.y),
                      w: pct(a.w),
                      h: pct(a.h),
                    }))}
                  />
                  {product.colors.length > 0 && (
                    <div className="space-y-1">
                      <div className="label">Product photo for this view, per color (link)</div>
                      {product.colors.map((c) => (
                        <div key={c.id} className="flex items-center gap-2 text-sm">
                          <span className="w-32 truncate">{c.name}</span>
                          <input
                            className="input"
                            name={`img_${c.id}`}
                            aria-label={`${view.name} photo for ${c.name}`}
                            defaultValue={view.images.find((i) => i.colorId === c.id)?.url ?? ""}
                            placeholder="https://…"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </ActionForm>
                <div>
                  <div className="label">Preview</div>
                  <div className="relative aspect-square w-full overflow-hidden rounded border border-gray-200 bg-gray-100">
                    {preview && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview} alt={`${product.name} ${view.name}`} className="absolute inset-0 h-full w-full object-contain" />
                    )}
                    {view.areas.map((a) => (
                      <div
                        key={a.id}
                        className="absolute border-2 border-dashed border-amber-500 bg-amber-200/20 text-[10px] text-amber-900"
                        style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: `${a.h * 100}%` }}
                      >
                        {a.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </Section>

      <Section title="Decoration methods" hint={`Methods offered for ${product.productType.name}. Turn one off or raise its minimum for this product only.`}>
        <ActionForm action={saveMethodRules}>
          <input type="hidden" name="productId" value={product.id} />
          <table className="table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Offered</th>
                <th>Min qty (blank = method default)</th>
              </tr>
            </thead>
            <tbody>
              {methods.map((m) => {
                const rule = product.methodRules.find((r) => r.methodId === m.id);
                return (
                  <tr key={m.id}>
                    <td>
                      <input type="hidden" name="methodId" value={m.id} />
                      {m.name}
                      {!m.active && <span className="ml-1 text-xs text-gray-400">(method inactive)</span>}
                    </td>
                    <td>
                      <input type="checkbox" name={`enabled_${m.id}`} aria-label={`Offer ${m.name}`} defaultChecked={rule?.enabled ?? true} />
                    </td>
                    <td>
                      <input className="input w-24" name={`minQty_${m.id}`} aria-label={`${m.name} minimum`} defaultValue={rule?.minQty?.toString() ?? ""} placeholder={String(m.minQty)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ActionForm>
      </Section>

      {hasAnyRole(staff.roles, ["ADMIN"]) && (
        <ActionForm action={deleteProduct} submitLabel="Delete product" danger confirm={`Delete ${product.name} and all its SKUs?`}>
          <input type="hidden" name="id" value={product.id} />
        </ActionForm>
      )}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2 className="font-semibold">{title}</h2>
      {hint && <p className="mb-3 text-sm text-gray-500">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </section>
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

function Select({ label, name, value, children }: { label: string; name: string; value: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select className="input" id={name} name={name} defaultValue={value}>{children}</select>
    </div>
  );
}
