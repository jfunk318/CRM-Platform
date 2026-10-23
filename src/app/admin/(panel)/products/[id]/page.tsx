import Link from "next/link";
import { hasAnyRole } from "@/lib/auth/roles";
import { ActionForm } from "@/components/admin/action-form";
import { deleteProduct, saveGeneral } from "../actions";
import { loadProduct } from "./load";
import { Field, SectionFrame, Select } from "./section";

export default async function ProductGeneralPage({ params }: { params: Promise<{ id: string }> }) {
  const { staff, db, product } = await loadProduct((await params).id);
  const [sold, quotes, designs, storeItems, types] = await Promise.all([
    db.orderLineSize.aggregate({ _sum: { qty: true }, where: { line: { design: { productId: product.id }, order: { type: "ORDER" } } } }),
    db.order.count({ where: { type: "QUOTE", lines: { some: { design: { productId: product.id } } } } }),
    db.design.count({ where: { productId: product.id } }),
    db.storeItem.count({ where: { design: { productId: product.id } } }),
    db.productType.findMany({ orderBy: { name: "asc" } }),
  ]);
  const base = `/admin/products/${product.id}`;

  return (
    <SectionFrame
      title="General"
      aside={
        <dl className="space-y-1" data-testid="product-stats">
          <Stat label="Number sold" value={(sold._sum.qty ?? 0).toLocaleString()} />
          <Stat label="Quotes with it" value={quotes.toLocaleString()} />
          <Stat label="Decorated products" value={(designs).toLocaleString()} href={`${base}/designs`} />
          <Stat label="In stores" value={storeItems.toLocaleString()} />
          <Stat label="Colors · sizes · SKUs" value={`${product._count.colors} · ${product._count.sizes} · ${product._count.variants}`} />
          {product.externalSource && (
            <p className="pt-2 text-xs text-gray-500">
              Imported from {product.supplier?.name ?? product.externalSource}. Re-importing updates costs, colors and photos but keeps the name, description and categories you set here.
            </p>
          )}
          {product.status === "ACTIVE" && (
            <p className="pt-2">
              <a href={`/catalog/${product.slug}`} target="_blank" className="text-amber-700 hover:underline">View on the main site ↗</a>
            </p>
          )}
        </dl>
      }
    >
      <ActionForm action={saveGeneral} className="max-w-3xl space-y-4">
        <input type="hidden" name="id" value={product.id} />
        <Select label="Status" name="status" value={product.status}>
          <option value="ACTIVE">Active for sale</option>
          <option value="CLOSING_OUT">Closing out (sell what&apos;s left)</option>
          <option value="DISCONTINUED">Discontinued (hidden from new quotes and the catalog)</option>
        </Select>
        <Field label="Product name" name="name" value={product.name} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product code (style)" name="styleCode" value={product.styleCode} required hint="SKUs are built from it, so changing it renames them." />
          <Field label="Brand" name="brand" value={product.brand ?? ""} />
          <Select label="Product type" name="productTypeId" value={product.productTypeId}>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <Field label="Web address (slug)" name="slug" value={product.slug} hint={`/catalog/${product.slug}`} />
        </div>
        <div className="space-y-1 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="allowBlankSale" defaultChecked={product.allowBlankSale} /> Allow blank purchase (sold without decoration)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isCustom" defaultChecked={product.isCustom} /> In-house / custom product
          </label>
        </div>
        <div>
          <label className="label" htmlFor="description">Description</label>
          <textarea className="input min-h-48" id="description" name="description" defaultValue={product.description ?? ""} />
          <p className="mt-1 text-xs text-gray-500">One point per line shows as a bulleted list on the storefront.</p>
        </div>
      </ActionForm>

      {hasAnyRole(staff.roles, ["ADMIN"]) && (
        <div className="max-w-3xl border-t border-gray-200 pt-4">
          <p className="mb-2 text-xs text-gray-500">
            Products on quotes, orders or in stores can&apos;t be deleted; set them to Discontinued instead. <Link href={`${base}/designs`} className="text-amber-700 hover:underline">See where it&apos;s used</Link>.
          </p>
          <ActionForm action={deleteProduct} submitLabel="Delete product" danger confirm={`Delete ${product.name} and all its SKUs?`}>
            <input type="hidden" name="id" value={product.id} />
          </ActionForm>
        </div>
      )}
    </SectionFrame>
  );
}

function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-600">{label}</dt>
      <dd className="font-medium">{href ? <Link href={href} className="text-amber-700 hover:underline">{value}</Link> : value}</dd>
    </div>
  );
}
