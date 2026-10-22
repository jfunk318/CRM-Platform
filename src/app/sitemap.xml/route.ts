import { requestOrigin } from "@/lib/business";
import { getRequestStore } from "@/lib/store/resolve";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Sitemap for the store at this address: pages, shop items and catalog products. */
export async function GET() {
  const rs = await getRequestStore();
  if (!rs || rs.store.accessCode) return new Response("Not found", { status: 404 });
  const origin = await requestOrigin();
  const [pages, items, products] = await Promise.all([
    rs.db.storePage.findMany({ where: { storeId: rs.store.id, published: true }, select: { slug: true, updatedAt: true } }),
    rs.db.storeItem.findMany({ where: { storeId: rs.store.id, published: true }, select: { slug: true, updatedAt: true } }),
    rs.store.kind === "ROOT" ? rs.db.product.findMany({ where: { status: "ACTIVE", variants: { some: { active: true } } }, select: { slug: true, updatedAt: true }, take: 5000 }) : [],
  ]);
  const urls = [
    { loc: "/", lastmod: pages.find((p) => p.slug === "home")?.updatedAt },
    { loc: "/shop" },
    ...(rs.store.kind === "ROOT" ? [{ loc: "/catalog" }, { loc: "/quote" }] : []),
    ...pages.filter((p) => p.slug !== "home").map((p) => ({ loc: `/${p.slug}`, lastmod: p.updatedAt })),
    ...items.map((i) => ({ loc: `/shop/${i.slug}`, lastmod: i.updatedAt })),
    ...products.map((p) => ({ loc: `/catalog/${p.slug}`, lastmod: p.updatedAt })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${esc(origin + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.toISOString()}</lastmod>` : ""}</url>`)
    .join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
