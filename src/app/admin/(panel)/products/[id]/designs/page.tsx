import Link from "next/link";
import { orderRef } from "@/lib/orders/numbers";
import { colorThumbnails } from "@/lib/catalog/thumbnails";
import { ProductThumb } from "@/components/admin/product-thumb";
import { loadProduct } from "../load";
import { SectionFrame } from "../section";

export default async function ProductDesignsPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, product } = await loadProduct((await params).id);
  const designs = await db.design.findMany({
    where: { productId: product.id },
    include: {
      color: true,
      customer: true,
      decorations: { include: { method: true }, orderBy: { sortOrder: "asc" } },
      orderLines: { include: { order: { select: { id: true, type: true, number: true } } } },
      storeItems: { include: { store: { select: { id: true, name: true } } } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  const photos = await colorThumbnails(db.$businessId, [...new Set(designs.map((d) => d.colorId))]);
  return (
    <SectionFrame
      title="Decorated Products"
      intro={<p>Every design made on this product: the items on quotes and orders, and the products sold in stores. Most recent first.</p>}
      aside={<p className="text-gray-600">{designs.length === 100 ? "Latest 100" : designs.length} design{designs.length === 1 ? "" : "s"}</p>}
    >
      {designs.length === 0 ? (
        <p className="text-sm text-gray-500">Not used on any quotes, orders or stores yet.</p>
      ) : (
        <table className="table" data-testid="designs">
          <thead>
            <tr><th></th><th>Design</th><th>Decoration</th><th>Used on</th></tr>
          </thead>
          <tbody>
            {designs.map((d) => (
              <tr key={d.id}>
                <td className="w-14 py-1.5"><ProductThumb url={photos.get(d.colorId)} label={d.color.name} size={44} /></td>
                <td>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-gray-500">{d.color.name}{d.customer ? ` · ${d.customer.firstName} ${d.customer.lastName}` : ""}</div>
                </td>
                <td className="text-sm">{d.decorations.length ? d.decorations.map((x) => `${x.location}: ${x.method.shortName}`).join(", ") : <span className="text-gray-400">Blank</span>}</td>
                <td className="text-sm">
                  <div className="flex flex-wrap gap-x-2">
                    {d.orderLines.map((l) => <Link key={l.id} href={`/admin/orders/${l.order.id}`} className="text-amber-700 hover:underline">{orderRef(l.order)}</Link>)}
                    {d.storeItems.map((i) => <Link key={i.id} href={`/admin/stores/${i.store.id}/items/${i.id}`} className="text-amber-700 hover:underline">{i.store.name}</Link>)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SectionFrame>
  );
}
