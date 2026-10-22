import Link from "next/link";
import { getRequestBusiness } from "@/lib/business";
import { PLATFORM_NAME } from "@/lib/platform";

export default async function Home() {
  const business = await getRequestBusiness();
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold">{business?.name ?? PLATFORM_NAME}</h1>
      <p className="mt-4 text-gray-600">
        {business ? "Storefront coming soon." : "Print-shop business platform."}
      </p>
      {!business && (
        <Link href="/platform" className="mt-6 inline-block text-amber-700 underline">Platform sign in</Link>
      )}
    </main>
  );
}
