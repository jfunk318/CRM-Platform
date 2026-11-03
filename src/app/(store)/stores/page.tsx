import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRequestStore } from "@/lib/store/resolve";
import { StoreShowcase } from "@/components/store/showcase";
import { DEFAULT_SHOWCASE } from "@/lib/store/showcase";

export async function generateMetadata(): Promise<Metadata> {
  const rs = await getRequestStore();
  return { title: rs ? `Team & group stores · ${rs.store.name}` : "Stores" };
}

/** The main site's directory of affiliate stores, with a search box and group filters. */
export default async function StoresDirectory() {
  const rs = await getRequestStore();
  if (!rs || rs.store.kind !== "ROOT") notFound();
  return (
    <div className="space-y-6 py-4" data-testid="stores-directory">
      <div className="max-w-2xl space-y-3">
        <h1 className="text-4xl leading-tight sm:text-5xl">Team &amp; group stores</h1>
        <p className="text-lg text-[var(--st-muted)]">Find your team, school, club or business and order your gear online. Can&apos;t find yours? <Link href="/quote" className="font-semibold text-[var(--accent)] hover:underline">Ask us about a store</Link>.</p>
      </div>
      <StoreShowcase db={rs.db} currentStoreId={rs.store.id} options={{ ...DEFAULT_SHOWCASE, limit: 48, columns: 4, filters: true, sort: "name" }} />
    </div>
  );
}
