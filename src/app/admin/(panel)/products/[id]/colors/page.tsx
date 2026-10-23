import { ActionForm } from "@/components/admin/action-form";
import { ProductThumb } from "@/components/admin/product-thumb";
import { RowsEditor } from "@/components/admin/rows-editor";
import { colorThumbnails } from "@/lib/catalog/thumbnails";
import { saveColors } from "../../actions";
import { loadProduct } from "../load";
import { SectionFrame } from "../section";

const SHADE_OPTIONS = [
  { value: "LIGHT", label: "Light" },
  { value: "DARK", label: "Dark (needs underbase)" },
  { value: "WHITE", label: "White" },
];

export default async function ProductColorsPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, product } = await loadProduct((await params).id);
  const colors = await db.productColor.findMany({ where: { productId: product.id }, orderBy: { sortOrder: "asc" }, include: { _count: { select: { variants: true } } } });
  const photos = await colorThumbnails(db.$businessId, colors.map((c) => c.id));
  return (
    <SectionFrame
      title="Colors"
      intro={
        <>
          <p>The colors this product comes in, in the order customers see them.</p>
          <p>Shade matters for pricing: dark garments get a white underbase for screen printing.</p>
          <p>Removing a color removes its SKUs and photos. Rename a color to keep them.</p>
        </>
      }
      aside={<p className="text-gray-600">{colors.length} color{colors.length === 1 ? "" : "s"}</p>}
    >
      {colors.length > 0 && (
        <div className="flex flex-wrap gap-3" data-testid="color-gallery">
          {colors.map((c) => (
            <div key={c.id} className="w-20 text-center text-xs">
              <ProductThumb url={photos.get(c.id)} label={c.name} size={80} />
              <div className="mt-1 flex items-center justify-center gap-1">
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border" style={{ background: c.hex ?? "#fff" }} />
                <span className="truncate" title={c.name}>{c.name}</span>
              </div>
              <div className="text-gray-400">{c._count.variants} SKUs</div>
            </div>
          ))}
        </div>
      )}
      <ActionForm action={saveColors} className="max-w-3xl space-y-4">
        <input type="hidden" name="productId" value={product.id} />
        <RowsEditor
          addLabel="Add color"
          columns={[
            { name: "colorId", label: "", type: "hidden" },
            { name: "name", label: "Name", placeholder: "Heather Navy" },
            { name: "hex", label: "Swatch (hex)", placeholder: "#1F2A44", width: "8rem" },
            { name: "shade", label: "Shade", type: "select", options: SHADE_OPTIONS },
          ]}
          initialRows={colors.map((c) => ({ colorId: c.id, name: c.name, hex: c.hex ?? "", shade: c.shade }))}
        />
      </ActionForm>
    </SectionFrame>
  );
}
