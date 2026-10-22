import { requestOrigin } from "@/lib/business";
import { getRequestStore } from "@/lib/store/resolve";

/** Private stores and the platform address stay out of search engines. */
export async function GET() {
  const rs = await getRequestStore();
  const origin = await requestOrigin();
  const body =
    !rs || rs.store.accessCode
      ? "User-agent: *\nDisallow: /\n"
      : `User-agent: *\nDisallow: /admin\nDisallow: /platform\nDisallow: /c/\nDisallow: /proof/\nDisallow: /cart\nDisallow: /checkout\nDisallow: /account\nSitemap: ${origin}/sitemap.xml\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
