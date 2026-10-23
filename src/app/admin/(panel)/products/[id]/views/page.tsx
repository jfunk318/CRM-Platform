import { ActionForm } from "@/components/admin/action-form";
import { RowsEditor } from "@/components/admin/rows-editor";
import { saveViewAreas, saveViews } from "../../actions";
import { loadProduct } from "../load";
import { SectionFrame } from "../section";

const pct = (n: number) => String(Math.round(n * 1000) / 10);

export default async function ProductViewsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ color?: string }> }) {
  const { db, product } = await loadProduct((await params).id);
  const sp = await searchParams;
  const [views, colors] = await Promise.all([
    db.productView.findMany({ where: { productId: product.id }, orderBy: { sortOrder: "asc" }, include: { areas: { orderBy: { name: "asc" } }, images: true } }),
    db.productColor.findMany({ where: { productId: product.id }, orderBy: { sortOrder: "asc" } }),
  ]);
  // Preview in the chosen color, else the first color that has photos.
  const withPhotos = colors.filter((c) => views.some((v) => v.images.some((i) => i.colorId === c.id)));
  const previewColor = colors.find((c) => c.id === sp.color) ?? withPhotos[0] ?? colors[0];

  return (
    <SectionFrame
      title="Views & Decoration Areas"
      intro={
        <>
          <p>Views are the sides of the product that can be decorated (front, back, sleeves).</p>
          <p>Decoration areas are where artwork can go on each view: the largest print size in inches, and the box on the photo shown to customers (in % of the photo&apos;s width and height).</p>
          <p>Quote and order items stay linked to an area when you rename or resize it.</p>
        </>
      }
      aside={
        withPhotos.length > 1 && (
          <form className="pt-2">
            <label className="label" htmlFor="preview-color">Preview color</label>
            <div className="flex gap-2">
              <select className="input" id="preview-color" name="color" defaultValue={previewColor?.id}>
                {withPhotos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button className="btn-secondary">Show</button>
            </div>
          </form>
        )
      }
    >
      <ActionForm action={saveViews} className="max-w-md space-y-3">
        <h3 className="font-medium">Views</h3>
        <input type="hidden" name="productId" value={product.id} />
        <RowsEditor
          addLabel="Add view"
          columns={[
            { name: "viewId", label: "", type: "hidden" },
            { name: "name", label: "View", placeholder: "Front" },
          ]}
          initialRows={views.map((v) => ({ viewId: v.id, name: v.name }))}
        />
      </ActionForm>

      {views.map((view) => {
        const preview = view.images.find((i) => i.colorId === previewColor?.id)?.url ?? view.images[0]?.url;
        return (
          <section key={view.id} className="rounded-md border border-gray-200 p-4" data-testid="view">
            <h3 className="mb-3 font-medium">{view.name}</h3>
            <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_300px]">
              <ActionForm action={saveViewAreas} className="space-y-3">
                <input type="hidden" name="viewId" value={view.id} />
                <RowsEditor
                  addLabel="Add decoration area"
                  columns={[
                    { name: "areaId", label: "", type: "hidden" },
                    { name: "name", label: "Area", placeholder: "Full Front", width: "11rem" },
                    { name: "widthIn", label: "Max width", width: "4.5rem", suffix: "in" },
                    { name: "heightIn", label: "Max height", width: "4.5rem", suffix: "in" },
                    { name: "x", label: "Left", width: "4.5rem", suffix: "%" },
                    { name: "y", label: "Top", width: "4.5rem", suffix: "%" },
                    { name: "w", label: "Box W", width: "4.5rem", suffix: "%" },
                    { name: "h", label: "Box H", width: "4.5rem", suffix: "%" },
                  ]}
                  initialRows={view.areas.map((a) => ({
                    areaId: a.id,
                    name: a.name,
                    widthIn: a.widthIn.toString(),
                    heightIn: a.heightIn.toString(),
                    x: pct(a.x),
                    y: pct(a.y),
                    w: pct(a.w),
                    h: pct(a.h),
                  }))}
                />
              </ActionForm>
              <div className="max-w-xs">
                <div className="relative aspect-square w-full overflow-hidden rounded border border-gray-200 bg-gray-100">
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt={`${product.name} ${view.name}`} className="absolute inset-0 h-full w-full object-contain" />
                  ) : (
                    <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-gray-500">No photo for this view yet. Add one under Images.</p>
                  )}
                  {view.areas.map((a) => (
                    <div
                      key={a.id}
                      className="absolute border-2 border-dashed border-amber-500 bg-amber-200/20 text-[10px] leading-tight text-amber-900"
                      style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: `${a.h * 100}%` }}
                    >
                      {a.name}
                    </div>
                  ))}
                </div>
                {previewColor && <p className="mt-1 text-center text-xs text-gray-500">{previewColor.name}</p>}
              </div>
            </div>
          </section>
        );
      })}
    </SectionFrame>
  );
}
