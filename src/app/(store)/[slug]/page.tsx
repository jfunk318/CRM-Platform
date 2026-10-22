import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestStore } from "@/lib/store/resolve";
import { PageBody } from "@/components/store/showcase";

async function load(slug: string) {
  const rs = await getRequestStore();
  if (!rs || slug === "home") return null;
  const page = await rs.db.storePage.findFirst({
    where: { storeId: rs.store.id, slug, published: true },
    include: { parent: true, children: { where: { published: true }, orderBy: [{ navOrder: "asc" }, { title: "asc" }] } },
  });
  return page ? { rs, page } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const found = await load((await params).slug);
  return found ? { title: found.page.seoTitle ?? `${found.page.title} · ${found.rs.store.name}`, description: found.page.seoDescription ?? undefined } : {};
}

/** A content page from the store's CMS. */
export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const found = await load((await params).slug);
  if (!found) notFound();
  const { page } = found;
  return (
    <article className="mx-auto max-w-3xl">
      {page.parent?.published && <Link href={`/${page.parent.slug}`} className="text-sm text-[var(--accent)] hover:underline">← {page.parent.title}</Link>}
      {!/^#\s/.test(page.body.trimStart()) && <h1 className="mb-4 text-3xl font-bold">{page.title}</h1>}
      <PageBody body={page.body} db={found.rs.db} currentStoreId={found.rs.store.id} />
      {page.children.length > 0 && (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {page.children.map((c) => (
            <li key={c.id}>
              <Link href={`/${c.slug}`} className="block rounded-lg border border-gray-200 p-4 font-medium hover:border-[var(--accent)]">{c.title} →</Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
