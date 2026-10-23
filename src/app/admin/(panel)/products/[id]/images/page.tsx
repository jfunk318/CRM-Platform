import { ActionForm } from "@/components/admin/action-form";
import { ProductThumb } from "@/components/admin/product-thumb";
import { saveImages } from "../../actions";
import { loadProduct } from "../load";
import { SectionFrame } from "../section";

export default async function ProductImagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, product } = await loadProduct((await params).id);
  const [views, colors] = await Promise.all([
    db.productView.findMany({ where: { productId: product.id }, orderBy: { sortOrder: "asc" }, include: { images: true } }),
    db.productColor.findMany({ where: { productId: product.id }, orderBy: { sortOrder: "asc" } }),
  ]);
  const total = views.reduce((n, v) => n + v.images.length, 0);
  return (
    <SectionFrame
      title="Images"
      intro={
        <>
          <p>A photo of each view in each color, used on quotes, the storefront and to place artwork in the decoration areas.</p>
          <p>Paste a link to the image. Imported products use the supplier&apos;s photos; re-importing refreshes them.</p>
        </>
      }
      aside={<p className="text-gray-600">{total} of {views.length * colors.length} photos</p>}
    >
      {views.length === 0 || colors.length === 0 ? (
        <p className="text-sm text-gray-500">Add colors and views first.</p>
      ) : (
        <ActionForm action={saveImages} className="space-y-4">
          <input type="hidden" name="productId" value={product.id} />
          <div className="overflow-x-auto">
            <table className="text-sm" data-testid="image-grid">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Color</th>
                  {views.map((v) => <th key={v.id} className="px-2 py-1 text-left text-xs font-medium text-gray-500">{v.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {colors.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100">
                    <td className="px-2 py-2 whitespace-nowrap">
                      <span className="mr-1.5 inline-block h-3 w-3 rounded-full border align-middle" style={{ background: c.hex ?? "#fff" }} />
                      {c.name}
                    </td>
                    {views.map((v) => {
                      const url = v.images.find((i) => i.colorId === c.id)?.url ?? "";
                      return (
                        <td key={v.id} className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <ProductThumb url={url} label="—" size={48} />
                            <input className="input w-64 text-xs" name={`img_${v.id}_${c.id}`} defaultValue={url} placeholder="https://…" aria-label={`${v.name} photo for ${c.name}`} />
                          </div>
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
    </SectionFrame>
  );
}
