import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { saveMethodRules } from "../../actions";
import { loadProduct } from "../load";
import { SectionFrame } from "../section";

export default async function ProductMethodsPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, product } = await loadProduct((await params).id);
  const [type, rules] = await Promise.all([
    db.productType.findUniqueOrThrow({ where: { id: product.productTypeId }, include: { decorationMethods: { include: { method: true } } } }),
    db.productDecorationRule.findMany({ where: { productId: product.id } }),
  ]);
  const methods = type.decorationMethods.map((d) => d.method).sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <SectionFrame
      title="Decoration Methods & Minimums"
      intro={
        <>
          <p>The methods offered for {type.name} products. Turn one off, or raise its minimum quantity, for this product only.</p>
          <p>Which methods a product type offers is set under <Link href="/admin/methods" className="text-amber-700 hover:underline">Decoration methods</Link>.</p>
        </>
      }
    >
      {methods.length === 0 ? (
        <p className="text-sm text-gray-500">No decoration methods are set up for {type.name} yet.</p>
      ) : (
        <ActionForm action={saveMethodRules} className="max-w-2xl space-y-4">
          <input type="hidden" name="productId" value={product.id} />
          <table className="table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Offered</th>
                <th>Minimum quantity</th>
              </tr>
            </thead>
            <tbody>
              {methods.map((m) => {
                const rule = rules.find((r) => r.methodId === m.id);
                return (
                  <tr key={m.id}>
                    <td>
                      <input type="hidden" name="methodId" value={m.id} />
                      {m.name}
                      {!m.active && <span className="ml-1 text-xs text-gray-400">(method turned off)</span>}
                    </td>
                    <td><input type="checkbox" name={`enabled_${m.id}`} aria-label={`Offer ${m.name}`} defaultChecked={rule?.enabled ?? true} /></td>
                    <td>
                      <input className="input w-24" name={`minQty_${m.id}`} aria-label={`${m.name} minimum`} defaultValue={rule?.minQty?.toString() ?? ""} placeholder={String(m.minQty)} />
                      <span className="ml-2 text-xs text-gray-500">blank = method&apos;s {m.minQty}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ActionForm>
      )}
    </SectionFrame>
  );
}
