import { getShop } from "@/lib/shop";

export default async function Home() {
  const shop = await getShop();
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold">{shop.name}</h1>
      <p className="mt-4 text-gray-600">Storefront coming soon.</p>
    </main>
  );
}
