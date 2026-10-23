import { ActionForm } from "@/components/admin/action-form";
import { RowsEditor } from "@/components/admin/rows-editor";
import { saveSizeChart, saveSizes } from "../../actions";
import { loadProduct } from "../load";
import { Field, SectionFrame } from "../section";

export default async function ProductSizingPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, product } = await loadProduct((await params).id);
  const sizes = await db.productSize.findMany({ where: { productId: product.id }, orderBy: { sortOrder: "asc" } });
  return (
    <SectionFrame
      title="Sizing"
      intro={
        <>
          <p>Sizes in the order they&apos;re shown on quotes, orders and size grids.</p>
          <p>Removing a size removes its SKUs. Rename a size to keep them.</p>
        </>
      }
    >
      <ActionForm action={saveSizes} className="max-w-xl space-y-4">
        <input type="hidden" name="productId" value={product.id} />
        <RowsEditor
          addLabel="Add size"
          columns={[
            { name: "sizeId", label: "", type: "hidden" },
            { name: "code", label: "Code", placeholder: "2XL" },
            { name: "label", label: "Label (optional)", placeholder: "2X-Large" },
          ]}
          initialRows={sizes.map((s) => ({ sizeId: s.id, code: s.code, label: s.label }))}
        />
      </ActionForm>

      <ActionForm action={saveSizeChart} className="max-w-xl space-y-3 border-t border-gray-200 pt-5">
        <h3 className="font-medium">Size chart</h3>
        <input type="hidden" name="id" value={product.id} />
        <Field label="Size chart image link" name="sizeChartImageUrl" value={product.sizeChartImageUrl ?? ""} placeholder="https://…" />
        {product.sizeChartImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.sizeChartImageUrl} alt="Size chart" className="max-h-64 rounded border" />
        )}
      </ActionForm>
    </SectionFrame>
  );
}
