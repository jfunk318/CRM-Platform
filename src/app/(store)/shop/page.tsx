import { notFound } from "next/navigation";
import { getRequestStore } from "@/lib/store/resolve";
import { ItemGrid, shopItemsInclude } from "@/components/store/items";

export async function generateMetadata() {
  const rs = await getRequestStore();
  return { title: rs ? `Shop · ${rs.store.name}` : "Shop" };
}

export default async function ShopPage() {
  const rs = await getRequestStore();
  if (!rs) notFound();
  const items = await rs.db.storeItem.findMany({
    where: { storeId: rs.store.id, published: true },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: shopItemsInclude,
  });
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Shop</h1>
      {items.length === 0 ? <p className="text-gray-600">Nothing for sale here yet.</p> : <ItemGrid items={items} store={rs.store} showPrices={rs.settings.showPrices} />}
    </div>
  );
}
