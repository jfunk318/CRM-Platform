import type { Category } from "@prisma/client";
import { requireStaff } from "@/lib/auth/session";
import { ActionForm } from "@/components/admin/action-form";
import { deleteCategory, saveCategory } from "./actions";

type Node = Category & { depth: number; productCount: number };

function flatten(all: (Category & { _count: { products: number } })[]): Node[] {
  const out: Node[] = [];
  const walk = (parentId: string | null, depth: number) =>
    all
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .forEach((c) => {
        out.push({ ...c, depth, productCount: c._count.products });
        walk(c.id, depth + 1);
      });
  walk(null, 0);
  return out;
}

export default async function CategoriesPage() {
  const { db } = await requireStaff(["SALES"]);
  const tree = flatten(await db.category.findMany({ include: { _count: { select: { products: true } } } }));
  const parentOptions = (excludeId?: string) =>
    tree
      .filter((c) => c.id !== excludeId)
      .map((c) => (
        <option key={c.id} value={c.id}>
          {"— ".repeat(c.depth)}{c.name}
        </option>
      ));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Categories</h1>
        <p className="text-sm text-gray-500">How products are grouped in the storefront menu.</p>
      </div>
      <div className="card space-y-2 p-2">
        {tree.map((c) => (
          <details key={c.id} className="rounded-md px-2 py-1 open:bg-gray-50" style={{ marginLeft: c.depth * 20 }}>
            <summary className="cursor-pointer text-sm">
              <span className="font-medium">{c.name}</span>{" "}
              <span className="text-xs text-gray-500">/{c.slug} · {c.productCount} product(s)</span>
            </summary>
            <div className="mt-2 space-y-2">
              <ActionForm action={saveCategory} className="grid gap-3 sm:grid-cols-5 sm:items-end">
                <input type="hidden" name="id" value={c.id} />
                <CategoryFields category={c} parents={parentOptions(c.id)} />
              </ActionForm>
              <ActionForm action={deleteCategory} submitLabel="Delete" danger confirm={`Delete ${c.name}?`}>
                <input type="hidden" name="id" value={c.id} />
              </ActionForm>
            </div>
          </details>
        ))}
      </div>
      <div className="card">
        <h2 className="mb-2 font-semibold">Add a category</h2>
        <ActionForm action={saveCategory} submitLabel="Add category" resetOnSuccess className="grid gap-3 sm:grid-cols-5 sm:items-end">
          <CategoryFields parents={parentOptions()} />
        </ActionForm>
      </div>
    </div>
  );
}

function CategoryFields({ category, parents }: { category?: Category; parents: React.ReactNode }) {
  const k = category?.id ?? "new";
  return (
    <>
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`cn-${k}`}>Name</label>
        <input className="input" id={`cn-${k}`} name="name" defaultValue={category?.name} required />
      </div>
      <div>
        <label className="label" htmlFor={`cs-${k}`}>URL slug</label>
        <input className="input" id={`cs-${k}`} name="slug" defaultValue={category?.slug} placeholder="from name" />
      </div>
      <div>
        <label className="label" htmlFor={`cp-${k}`}>Inside</label>
        <select className="input" id={`cp-${k}`} name="parentId" defaultValue={category?.parentId ?? ""}>
          <option value="">(top level)</option>
          {parents}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={`co-${k}`}>Sort order</label>
        <input className="input" id={`co-${k}`} name="sortOrder" defaultValue={category?.sortOrder ?? 0} />
      </div>
    </>
  );
}
