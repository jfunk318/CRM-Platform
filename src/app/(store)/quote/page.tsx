import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestStore } from "@/lib/store/resolve";
import { QuoteForm } from "@/components/store/quote-form";

export const metadata = { title: "Request a quote" };

export default async function QuotePage() {
  const rs = await getRequestStore();
  if (!rs || rs.store.kind !== "ROOT") notFound();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-3xl font-bold">Request a quote</h1>
      <p className="text-[var(--st-muted)]">Tell us what you have in mind and we&apos;ll email you a quote, usually within a business day. Pick a specific garment from the <Link href="/catalog" className="text-[var(--accent)] underline">catalog</Link> if you know what you want.</p>
      <QuoteForm />
    </div>
  );
}
