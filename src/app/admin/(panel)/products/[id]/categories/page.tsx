import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { saveCategories } from "../../actions";
import { loadProduct } from "../load";
import { SectionFrame } from "../section";

export default async function ProductCategoriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, product } = await loadProduct((await params).id);
  const [categories, chosen] = await Promise.all([
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.productCategory.findMany({ where: { productId: product.id }, select: { categoryId: true } }),
  ]);
  const picked = new Set(chosen.map((c) => c.categoryId));
  const roots = categories.filter((c) => !c.parentId || !categories.some((p) => p.id === c.parentId));
  const children = (id: string) => categories.filter((c) => c.parentId === id);
  const box = (c: (typeof categories)[number]) => (
    <label key={c.id} className="flex items-center gap-2">
      <input type="checkbox" name="categoryIds" value={c.id} defaultChecked={picked.has(c.id)} /> {c.name}
    </label>
  );
  return (
    <SectionFrame
      title="Categories"
      intro={
        <>
          <p>Where this product appears when browsing the catalog and filtering products.</p>
          <p>Add or rename categories under <Link href="/admin/categories" className="text-amber-700 hover:underline">Categories</Link>.</p>
        </>
      }
      aside={<p className="text-gray-600">In {picked.size} categor{picked.size === 1 ? "y" : "ies"}</p>}
    >
      {categories.length === 0 ? (
        <p className="text-sm text-gray-500">No categories yet.</p>
      ) : (
        <ActionForm action={saveCategories} className="max-w-3xl space-y-4">
          <input type="hidden" name="id" value={product.id} />
          <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3" data-testid="category-list">
            {roots.map((c) => (
              <div key={c.id}>
                {box(c)}
                {children(c.id).length > 0 && <div className="ml-6 space-y-1">{children(c.id).map(box)}</div>}
              </div>
            ))}
          </div>
        </ActionForm>
      )}
    </SectionFrame>
  );
}
