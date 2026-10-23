import Link from "next/link";
import { ProductImage } from "@/components/product-image";
import { productThumbnails } from "@/lib/catalog/thumbnails";
import { loadProduct } from "./load";
import { SectionNav } from "./section-nav";

const STATUS_CLASS = { ACTIVE: "", CLOSING_OUT: "bg-amber-100 text-amber-900", DISCONTINUED: "bg-gray-200 text-gray-700" } as const;
const STATUS_LABEL = { ACTIVE: "", CLOSING_OUT: "Closing out", DISCONTINUED: "Discontinued" } as const;

/** A product's page: photo and section list on the left, the chosen section on the right. */
export default async function ProductLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, product } = await loadProduct(id);
  const photo = (await productThumbnails(db.$businessId, [product.id])).get(product.id);
  return (
    <div className="-mx-4 -my-6 md:-mx-8 md:flex md:min-h-screen">
      <aside className="border-b border-gray-200 bg-white md:w-64 md:shrink-0 md:border-r md:border-b-0">
        <div className="px-4 pt-4">
          <Link href="/admin/products" className="text-sm text-amber-700 hover:underline">← Products</Link>
        </div>
        <div className="mx-4 mt-2 flex items-center gap-3 md:block">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-gray-100 md:aspect-square md:h-auto md:w-full" data-testid="product-photo">
            {photo ? (
              <ProductImage src={photo} alt="" width={480} height={480} sizes="(min-width: 768px) 240px, 80px" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center font-mono text-xs font-bold text-gray-300 md:text-2xl">{product.styleCode}</div>
            )}
            <div className="absolute inset-x-3 top-1/2 hidden -translate-y-1/2 rounded bg-black/55 px-3 py-2 text-center text-sm font-medium text-white md:block">
              <h1>{product.name}</h1>
              <div className="font-mono text-xs font-normal text-white/80">{product.styleCode}</div>
            </div>
            {product.status !== "ACTIVE" && (
              <span className={`absolute top-2 left-2 hidden rounded-full px-2 py-0.5 text-xs font-medium md:inline ${STATUS_CLASS[product.status]}`}>{STATUS_LABEL[product.status]}</span>
            )}
          </div>
          {/* On phones the name sits beside a small photo. */}
          <div className="md:hidden">
            <div className="font-semibold">{product.name}</div>
            <div className="font-mono text-xs text-gray-500">{product.styleCode}{product.status !== "ACTIVE" ? ` · ${STATUS_LABEL[product.status]}` : ""}</div>
          </div>
        </div>
        <div className="mt-3 border-t border-gray-100">
          <SectionNav productId={product.id} />
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
