import Link from "next/link";
import { productSearch } from "@/lib/catalog/search";
import type { Prisma } from "@prisma/client";
import { requireStaff } from "@/lib/auth/session";
import { ActionForm } from "@/components/admin/action-form";
import { ProductThumb } from "@/components/admin/product-thumb";
import { productThumbnails } from "@/lib/catalog/thumbnails";
import { createProduct } from "./actions";

const STATUS_LABELS = { ACTIVE: "Active", CLOSING_OUT: "Closing out", DISCONTINUED: "Discontinued" } as const;
const PAGE_SIZE = 50;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; supplier?: string; category?: string; page?: string }>;
}) {
  const { db } = await requireStaff(["SALES", "PURCHASING"]);
  const { q = "", supplier = "", category = "", page = "1" } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);

  const where: Prisma.ProductWhereInput = {
    ...productSearch(q),
    ...(supplier && { supplierId: supplier }),
    ...(category && { categories: { some: { categoryId: category } } }),
  };

  const [products, total, suppliers, categories, types] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { supplier: true, _count: { select: { variants: true, colors: true } } },
    }),
    db.product.count({ where }),
    db.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.category.findMany({ orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }] }),
    db.productType.findMany({ orderBy: { name: "asc" } }),
  ]);
  const thumbs = await productThumbnails(db.$businessId, products.map((p) => p.id));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => new URLSearchParams({ q, supplier, category, page: String(p) }).toString();

  return (
    <div className="space-y-6">
      <h1 className="page-title">Products</h1>

      <form className="card flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="q">Search</label>
          <input className="input" id="q" name="q" defaultValue={q} placeholder="Name, style code or brand" />
        </div>
        <div>
          <label className="label" htmlFor="supplier">Supplier</label>
          <select className="input" id="supplier" name="supplier" defaultValue={supplier}>
            <option value="">All</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="category">Category</label>
          <select className="input" id="category" name="category" defaultValue={category}>
            <option value="">All</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button className="btn-secondary">Filter</button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="table" data-testid="products">
          <thead>
            <tr>
              <th className="w-14"></th>
              <th>Product</th>
              <th>Style</th>
              <th>Supplier</th>
              <th>Colors</th>
              <th>SKUs</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-gray-500">
                  {total === 0 && !q && !supplier && !category ? "No products yet. Add the first one below." : "No matches."}
                </td>
              </tr>
            )}
            {products.map((p) => (
              <tr key={p.id}>
                <td className="py-1.5">
                  <Link href={`/admin/products/${p.id}`} aria-hidden tabIndex={-1}>
                    <ProductThumb url={thumbs.get(p.id)} label={p.styleCode} size={44} />
                  </Link>
                </td>
                <td>
                  <Link href={`/admin/products/${p.id}`} className="font-medium text-brand-700 hover:underline">{p.name}</Link>
                  {p.brand && <div className="text-xs text-gray-500">{p.brand}</div>}
                </td>
                <td className="font-mono text-xs">{p.styleCode}</td>
                <td>{p.supplier?.name ?? <span className="text-gray-400">In-house</span>}</td>
                <td>{p._count.colors}</td>
                <td>{p._count.variants}</td>
                <td>{STATUS_LABELS[p.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {pageNum > 1 && <Link className="btn-secondary" href={`?${qs(pageNum - 1)}`}>← Previous</Link>}
          <span>Page {pageNum} of {pages} ({total} products)</span>
          {pageNum < pages && <Link className="btn-secondary" href={`?${qs(pageNum + 1)}`}>Next →</Link>}
        </div>
      )}

      <div className="card">
        <h2 className="mb-2 font-semibold">Add a product</h2>
        <ActionForm action={createProduct} submitLabel="Create and edit" className="grid gap-3 sm:grid-cols-5 sm:items-end">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="np-name">Name</label>
            <input className="input" id="np-name" name="name" placeholder="Ladies Premium Cotton T-Shirt" required />
          </div>
          <div>
            <label className="label" htmlFor="np-style">Style code</label>
            <input className="input" id="np-style" name="styleCode" placeholder="DM104L" required />
          </div>
          <div>
            <label className="label" htmlFor="np-supplier">Supplier</label>
            <select className="input" id="np-supplier" name="supplierId">
              <option value="">In-house / custom</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="np-type">Type</label>
            <select className="input" id="np-type" name="productTypeId">
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
