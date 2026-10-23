import Link from "next/link";
import { blankUnitPrice } from "@/lib/pricing";
import { ActionForm } from "@/components/admin/action-form";
import { saveCosts, saveQuantityDiscount } from "../../actions";
import { loadProduct } from "../load";
import { SectionFrame, Select } from "../section";

export default async function ProductPricingPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, product } = await loadProduct((await params).id);
  const [colors, sizes, variants, discounts, pricing] = await Promise.all([
    db.productColor.findMany({ where: { productId: product.id }, orderBy: { sortOrder: "asc" } }),
    db.productSize.findMany({ where: { productId: product.id }, orderBy: { sortOrder: "asc" } }),
    db.productVariant.findMany({ where: { productId: product.id }, select: { colorId: true, sizeId: true, wholesaleCost: true } }),
    db.quantityDiscount.findMany({ orderBy: { name: "asc" } }),
    db.pricingGroup.findFirst({ where: { isDefault: true }, include: { markupTiers: true } }),
  ]);
  const cost = new Map(variants.map((v) => [`${v.colorId}_${v.sizeId}`, v.wholesaleCost]));
  const retail = (c: { toString(): string }) => {
    if (!pricing) return null;
    try {
      return blankUnitPrice(c.toString(), pricing.markupTiers, pricing.markupMode).toFixed(2);
    } catch {
      return null;
    }
  };
  const costs = variants.map((v) => v.wholesaleCost.toNumber());
  const range = costs.length ? `$${Math.min(...costs).toFixed(2)} – $${Math.max(...costs).toFixed(2)}` : "—";

  return (
    <SectionFrame
      title="Pricing"
      intro={
        <>
          <p>Your wholesale cost for each color and size. Leave a cost blank if that combination isn&apos;t offered; a new cost adds the SKU.</p>
          <p>Under each cost is the blank garment price at the {pricing?.name ?? "default"} markup. Decoration is priced from your <Link href="/admin/methods" className="text-amber-700 hover:underline">decoration methods</Link>.</p>
        </>
      }
      aside={
        <>
          <div className="flex justify-between"><span className="text-gray-600">Cost range</span><span className="font-medium">{range}</span></div>
          <p className="pt-2"><Link href={`/admin/price-check?product=${product.id}`} className="text-amber-700 hover:underline">Price a decorated order →</Link></p>
        </>
      }
    >
      <ActionForm action={saveQuantityDiscount} className="flex max-w-xl flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={product.id} />
        <div className="min-w-56 flex-1">
          <Select label="Quantity discount" name="quantityDiscountId" value={product.quantityDiscountId ?? ""}>
            <option value="">None</option>
            {discounts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </div>
      </ActionForm>

      <div className="border-t border-gray-200 pt-5">
        <h3 className="mb-3 font-medium">Costs</h3>
        {colors.length === 0 || sizes.length === 0 ? (
          <p className="text-sm text-gray-500">Add colors and sizes first.</p>
        ) : (
          <ActionForm action={saveCosts} submitLabel="Save costs">
            <input type="hidden" name="productId" value={product.id} />
            <div className="overflow-x-auto">
              <table className="text-sm" data-testid="cost-grid">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Color</th>
                    {sizes.map((s) => <th key={s.id} className="px-2 py-1 text-left text-xs font-medium text-gray-500">{s.code}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {colors.map((c) => (
                    <tr key={c.id} className="border-t border-gray-100">
                      <td className="px-2 py-2 align-top whitespace-nowrap">
                        <span className="mr-1.5 inline-block h-3 w-3 rounded-full border align-middle" style={{ background: c.hex ?? "#fff" }} />
                        {c.name}
                      </td>
                      {sizes.map((s) => {
                        const v = cost.get(`${c.id}_${s.id}`);
                        return (
                          <td key={s.id} className="px-1 py-1 align-top">
                            <input className="input w-20" name={`cost_${c.id}_${s.id}`} aria-label={`${c.name} ${s.code} cost`} defaultValue={v?.toFixed(2) ?? ""} placeholder="—" inputMode="decimal" />
                            {v && <div className="mt-0.5 text-xs text-gray-500">${retail(v) ?? "?"}</div>}
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
      </div>
    </SectionFrame>
  );
}
