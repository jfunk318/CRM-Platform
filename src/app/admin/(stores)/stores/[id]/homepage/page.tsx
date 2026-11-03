import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { HomepageBuilder } from "@/components/admin/homepage-builder";
import { loadAdminStore } from "@/lib/store/admin";
import { parseSite, sectionsOf, SOCIALS, type SocialKey } from "@/lib/store/homepage";
import { saveSiteDetailsAction } from "../../actions";

const PLACEHOLDER: Record<SocialKey, string> = {
  instagram: "https://instagram.com/yourshop",
  facebook: "https://facebook.com/yourshop",
  tiktok: "https://tiktok.com/@yourshop",
  x: "https://x.com/yourshop",
  youtube: "https://youtube.com/@yourshop",
  linkedin: "https://linkedin.com/company/yourshop",
  pinterest: "https://pinterest.com/yourshop",
  google: "https://g.page/r/…",
};

/** The main site's homepage builder and its site-wide details. */
export default async function HomepagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, store, url } = await loadAdminStore(id);
  if (store.kind !== "ROOT") redirect(`/admin/stores/${id}/look`);
  const business = await db.business.findUniqueOrThrow({ where: { id: db.$businessId } });
  const site = parseSite(store.siteSettings);
  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-gray-600">
        Your business&apos;s front page: what you do, your team stores, your own goods and how to reach you. Colors, fonts, logo and favicon are under{" "}
        <Link href={`/admin/stores/${id}/look`} className="text-brand-700 hover:underline">Look</Link>; extra pages (FAQ, policies) under{" "}
        <Link href={`/admin/stores/${id}/pages`} className="text-brand-700 hover:underline">Pages</Link>; address, phone and email under{" "}
        <Link href="/admin/settings" className="text-brand-700 hover:underline">Shop &amp; tax</Link>.
      </p>

      <HomepageBuilder storeId={store.id} initial={sectionsOf(store, business)} url={url} custom={store.homeSections !== null} />

      <section className="card" id="site-details" data-testid="site-details">
        <h2 className="font-semibold">Site details</h2>
        <p className="text-sm text-gray-600">Social links, opening hours and the header button, used across the whole site.</p>
        <ActionForm action={saveSiteDetailsAction} submitLabel="Save site details" className="mt-4 space-y-5">
          <input type="hidden" name="storeId" value={store.id} />
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Social links</legend>
            <p className="text-xs text-gray-500">Shown as icons in the header menu, the footer and the Contact section, and given to search engines. Leave blank to hide one.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(SOCIALS) as SocialKey[]).map((k) => (
                <div key={k}>
                  <label className="label" htmlFor={`social_${k}`}>{SOCIALS[k]}</label>
                  <input className="input" id={`social_${k}`} name={`social_${k}`} defaultValue={site.social[k] ?? ""} placeholder={PLACEHOLDER[k]} />
                </div>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <label className="label" htmlFor="hours">Opening hours</label>
              <textarea className="input" id="hours" name="hours" rows={4} defaultValue={site.hours} placeholder={"Mon–Fri 9am – 5pm\nSat 10am – 2pm\nSun closed"} />
            </div>
            <fieldset className="space-y-2">
              <legend className="label">Header button</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <input className="input" name="buttonLabel" defaultValue={site.headerButton.label} placeholder="Get a quote" aria-label="Header button text" maxLength={40} />
                <input className="input" name="buttonHref" defaultValue={site.headerButton.href} placeholder="/quote" aria-label="Header button link" />
              </div>
              <p className="text-xs text-gray-500">Leave the text blank for no button.</p>
              <label className="flex items-center gap-2 pt-2 text-sm"><input type="checkbox" name="storesLink" defaultChecked={site.storesLink} /> &ldquo;Team stores&rdquo; in the menu (a page listing every store)</label>
            </fieldset>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
