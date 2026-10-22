import { storeUrlHere } from "@/lib/business";
import type { BusinessDb } from "@/lib/db";
import { splitBlocks, type ShowcaseOptions } from "@/lib/store/showcase";
import { storeStatus } from "@/lib/store/settings";
import { Markdown } from "./markdown";

const COLS = ["", "sm:grid-cols-1", "sm:grid-cols-2", "sm:grid-cols-3", "sm:grid-cols-4", "sm:grid-cols-5", "sm:grid-cols-6"];

/** A page's content, with any [[stores]] lines shown as store showcases. */
export function PageBody({ body, db, currentStoreId }: { body: string; db: BusinessDb; currentStoreId: string }) {
  return (
    <>
      {splitBlocks(body).map((b, i) =>
        b.kind === "markdown" ? <Markdown key={i} source={b.source} /> : <StoreShowcase key={i} db={db} options={b.options} currentStoreId={currentStoreId} />,
      )}
    </>
  );
}

/** Affiliate stores as cards linking to their own addresses. */
export async function StoreShowcase({ db, options, currentStoreId }: { db: BusinessDb; options: ShowcaseOptions; currentStoreId: string }) {
  const stores = await db.store.findMany({
    where: {
      kind: "AFFILIATE",
      showcase: true,
      id: { not: currentStoreId },
      ...(options.group ? { group: { name: { equals: options.group, mode: "insensitive" } } } : {}),
    },
    include: {
      items: { where: { published: true }, orderBy: [{ featured: "desc" }, { sortOrder: "asc" }], take: 3, select: { id: true, imageFileId: true, name: true } },
    },
    orderBy: options.sort === "oldest" ? { createdAt: "asc" } : options.sort === "name" ? { name: "asc" } : { createdAt: "desc" },
  });
  let shown = stores.filter((s) => options.includeClosed || storeStatus(s).state === "open");
  if (options.sort === "sales") {
    const sales = await db.order.groupBy({ by: ["storeId"], where: { type: "ORDER", storeId: { in: shown.map((s) => s.id) } }, _sum: { total: true } });
    const total = (id: string) => sales.find((x) => x.storeId === id)?._sum.total?.toNumber() ?? 0;
    shown = [...shown].sort((a, b) => total(b.id) - total(a.id));
  }
  shown = shown.slice(0, options.limit);
  if (shown.length === 0) return <p className="my-4 text-gray-500">No stores to show right now.</p>;
  const urls = await Promise.all(shown.map((s) => storeUrlHere(s.slug)));
  return (
    <div className={`my-6 grid grid-cols-2 gap-5 ${COLS[options.columns]}`} data-testid="showcase">
      {shown.map((s, i) => (
        <a key={s.id} href={urls[i]} className="group block overflow-hidden rounded-lg border border-gray-200 bg-white hover:border-[var(--accent)]">
          <div className="flex h-28 items-center justify-center p-4" style={{ background: s.accentColor ?? "#f3f4f6" }}>
            {s.logoFileId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/media/${s.logoFileId}`} alt={s.name} className="max-h-20 w-auto" />
            ) : (
              <span className="text-center text-xl font-bold text-white drop-shadow">{s.name}</span>
            )}
          </div>
          <div className="space-y-1 p-3">
            <div className="font-semibold group-hover:text-[var(--accent)]">{s.name}</div>
            {s.tagline && <div className="text-sm text-gray-600">{s.tagline}</div>}
            {s.items.some((it) => it.imageFileId) && (
              <div className="flex gap-1.5 pt-1">
                {s.items.filter((it) => it.imageFileId).map((it) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={it.id} src={`/media/${it.imageFileId}`} alt={it.name} className="h-10 w-10 rounded object-cover" />
                ))}
              </div>
            )}
            <div className="text-xs text-[var(--accent)]">Visit the store →</div>
          </div>
        </a>
      ))}
    </div>
  );
}
