import Link from "next/link";
import type { Business, Store, StoreGroup } from "@prisma/client";
import type { BusinessDb } from "@/lib/db";
import { bannerArtOf } from "@/lib/store/banner-art";
import { DEFAULT_SHOWCASE } from "@/lib/store/showcase";
import { storeStatus } from "@/lib/store/settings";
import { type FieldValue, type IconKey, type Link as SiteLink, type Section, sectionAnchors, type SiteSettings, SOCIALS, type SocialKey } from "@/lib/store/homepage";
import { BannerArt } from "./banner-art";
import { ItemGrid, itemImage, shopItemsInclude } from "./items";
import { Markdown } from "./markdown";
import { PageBody, StoreShowcase } from "./showcase";
import { ServiceIcon, SocialIcon } from "./site-icons";

type Ctx = { db: BusinessDb; store: Store & { group: StoreGroup | null }; business: Business; site: SiteSettings; showPrices: boolean };
type Rows = Record<string, FieldValue>[];

/** Edge to edge, whatever the page width. */
const BLEED = "relative left-1/2 w-screen -translate-x-1/2";
const INNER = "mx-auto w-full max-w-6xl px-4";
const STAT_COLS = ["", "md:grid-cols-1", "md:grid-cols-2", "md:grid-cols-3", "md:grid-cols-4"];

const s = (v: FieldValue | undefined) => (typeof v === "string" ? v : "");
const n = (v: FieldValue | undefined, d: number) => (typeof v === "number" ? v : d);
const link = (v: FieldValue | undefined): SiteLink | null => (v && typeof v === "object" && !Array.isArray(v) && (v as SiteLink).href ? (v as SiteLink) : null);
const rows = (v: FieldValue | undefined): Rows => (Array.isArray(v) ? v : []);
const img = (id: string | null | undefined) => (id ? `/media/${id}` : null);

/** The main site's homepage: its sections in order, each a full-width band. */
export async function HomeSections({ sections, ...ctx }: Ctx & { sections: Section[] }) {
  const shown = sections.filter((x) => x.on);
  const anchors = sectionAnchors(shown);
  return (
    <div className="-mt-8 -mb-24" data-testid="home-sections">
      {shown.map((section, i) => (
        <SectionBand key={section.id} section={section} anchor={anchors.get(section.id) ?? null} index={i} ctx={ctx} />
      ))}
    </div>
  );
}

async function SectionBand({ section, anchor, index, ctx }: { section: Section; anchor: string | null; index: number; ctx: Ctx }) {
  const d = section.data;
  const body = await renderSection(section, ctx);
  if (!body) return null;
  // Banner, call to action and logos style themselves; the rest alternate plain and tinted.
  const own = section.kind === "hero" || section.kind === "cta" || section.kind === "logos" || section.kind === "stats";
  const tint = !own && index % 2 === 0 ? "bg-[var(--st-subtle)]" : "";
  return (
    <section id={anchor ?? undefined} className={`${BLEED} scroll-mt-24 ${tint}`} data-testid={`home-${section.kind}`} data-section={section.id}>
      {own ? body : (
        <div className={`${INNER} py-16 md:py-20`}>
          {(s(d.title) || s(d.intro)) && <Heading title={s(d.title)} intro={s(d.intro)} />}
          {body}
        </div>
      )}
    </section>
  );
}

function Heading({ title, intro, center = false }: { title: string; intro?: string; center?: boolean }) {
  return (
    <div className={`mb-10 max-w-2xl space-y-3 ${center ? "mx-auto text-center" : ""}`}>
      {title && <h2 className="text-3xl leading-tight sm:text-4xl">{title}</h2>}
      {intro && <p className="text-lg text-[var(--st-muted)]">{intro}</p>}
    </div>
  );
}

function Buttons({ primary, secondary, invert = false, center = false }: { primary: SiteLink | null; secondary: SiteLink | null; invert?: boolean; center?: boolean }) {
  if (!primary && !secondary) return null;
  return (
    <div className={`flex flex-wrap gap-3 ${center ? "justify-center" : ""}`}>
      {primary && (
        <Link href={primary.href} className={invert ? "st-btn !bg-[var(--accent-contrast)] !px-6 !py-3 !text-base !text-[var(--accent)]" : "st-btn !px-6 !py-3 !text-base"} data-testid="home-primary">
          {primary.label}
        </Link>
      )}
      {secondary && (
        <Link href={secondary.href} className="st-btn-outline !px-6 !py-3 !text-base hover:opacity-80">
          {secondary.label}
        </Link>
      )}
    </div>
  );
}

async function renderSection(section: Section, ctx: Ctx): Promise<React.ReactNode> {
  const d = section.data;
  const { db, store, business, site } = ctx;
  switch (section.kind) {
    case "hero":
      return <Hero section={section} ctx={ctx} />;

    case "logos": {
      const stores = await db.store.findMany({ where: { kind: "AFFILIATE", showcase: true, active: true, logoFileId: { not: null } }, orderBy: { createdAt: "desc" }, take: n(d.limit, 12), select: { id: true, name: true, logoFileId: true } });
      if (stores.length < 3) return null;
      return (
        <div className={`${INNER} py-10`}>
          {s(d.title) && <p className="mb-6 text-center text-xs font-semibold tracking-[0.2em] text-[var(--st-muted)] uppercase">{s(d.title)}</p>}
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
            {stores.map((x) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={x.id} src={img(x.logoFileId)!} alt={x.name} title={x.name} className="h-10 w-auto max-w-[8rem] object-contain opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0" />
            ))}
          </div>
        </div>
      );
    }

    case "stats": {
      const items = rows(d.items).filter((r) => s(r.value));
      if (!items.length) return null;
      return (
        <div className="bg-[var(--accent)] text-[var(--accent-contrast)]">
          <dl className={`${INNER} grid grid-cols-2 gap-8 py-12 text-center ${STAT_COLS[Math.min(items.length, 4)]}`}>
            {items.map((r, i) => (
              <div key={i}>
                <dt className="sr-only">{s(r.label)}</dt>
                <dd className="st-heading text-4xl sm:text-5xl">{s(r.value)}</dd>
                <dd className="mt-1 text-sm opacity-85">{s(r.label)}</dd>
              </div>
            ))}
          </dl>
        </div>
      );
    }

    case "services": {
      const items = rows(d.items);
      if (!items.length) return null;
      return (
        <div className={`grid gap-5 sm:grid-cols-2 ${items.length % 3 === 0 || items.length > 4 ? "lg:grid-cols-3" : items.length === 4 ? "lg:grid-cols-4" : ""}`}>
          {items.map((r, i) => {
            const to = link(r.link);
            return (
              <div key={i} className="st-panel group flex flex-col gap-3 p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
                <span className="grid h-12 w-12 place-items-center bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]" style={{ borderRadius: "var(--st-radius)" }}>
                  <ServiceIcon icon={s(r.icon) as IconKey} />
                </span>
                <h3 className="text-lg">{s(r.title)}</h3>
                {s(r.text) && <p className="flex-1 text-sm leading-relaxed text-[var(--st-muted)]">{s(r.text)}</p>}
                {to && <Link href={to.href} className="text-sm font-semibold text-[var(--accent)] hover:underline">{to.label} →</Link>}
              </div>
            );
          })}
        </div>
      );
    }

    case "stores": {
      const total = await db.store.count({ where: { kind: "AFFILIATE", showcase: true, active: true } });
      if (!total) return null;
      const sort = s(d.sort) as typeof DEFAULT_SHOWCASE.sort;
      return (
        <div className="space-y-6">
          <StoreShowcase db={db} currentStoreId={store.id} options={{ ...DEFAULT_SHOWCASE, group: s(d.group) || null, sort, limit: n(d.limit, 8), columns: 4, filters: d.search === true }} />
          {site.storesLink && (
            <Link href="/stores" className="st-btn-outline">See every store →</Link>
          )}
        </div>
      );
    }

    case "shop": {
      const items = await db.storeItem.findMany({
        where: { storeId: store.id, published: true, ...(d.featuredOnly === true ? { featured: true } : {}) },
        orderBy: [{ featured: "desc" }, { sortOrder: "asc" }],
        take: n(d.limit, 8),
        include: shopItemsInclude,
      });
      if (!items.length) return null;
      return (
        <div className="space-y-6">
          <ItemGrid items={items} store={store} showPrices={ctx.showPrices} />
          <Link href="/shop" className="st-btn-outline">Shop everything →</Link>
        </div>
      );
    }

    case "about": {
      const points = rows(d.points).filter((r) => s(r.text));
      const photo = img(s(d.image));
      if (!s(d.body) && !points.length) return null;
      return (
        <div className={`grid items-center gap-10 ${photo ? "md:grid-cols-2" : ""}`}>
          <div className="space-y-6">
            <div className="max-w-none text-lg leading-relaxed text-[var(--st-muted)] [&>*:first-child]:mt-0 [&_*:first-child]:mt-0"><Markdown source={s(d.body)} /></div>
            {points.length > 0 && (
              <ul className="grid gap-3 sm:grid-cols-2">
                {points.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm font-medium">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[10px] text-[var(--accent-contrast)]" aria-hidden="true">✓</span>
                    {s(r.text)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="aspect-[4/3] w-full object-cover shadow-xl" style={{ borderRadius: "var(--st-radius)" }} />
          )}
        </div>
      );
    }

    case "steps": {
      const items = rows(d.items).filter((r) => s(r.title));
      if (!items.length) return null;
      return (
        <ol className={`grid gap-8 sm:grid-cols-2 ${items.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          {items.map((r, i) => (
            <li key={i} className="relative space-y-2">
              <span className="st-heading block text-5xl text-[var(--accent)] opacity-90">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="text-lg">{s(r.title)}</h3>
              {s(r.text) && <p className="text-sm leading-relaxed text-[var(--st-muted)]">{s(r.text)}</p>}
            </li>
          ))}
        </ol>
      );
    }

    case "gallery": {
      let pictures = rows(d.images).filter((r) => s(r.image)).map((r, i) => ({ key: `u${i}`, src: img(s(r.image))!, caption: s(r.caption) }));
      if (!pictures.length) {
        // No photos uploaded: the latest store items' pictures, from every store.
        const items = await db.storeItem.findMany({ where: { published: true, store: { active: true } }, orderBy: { createdAt: "desc" }, take: 24, include: shopItemsInclude });
        pictures = items.map((it) => ({ key: it.id, src: itemImage(it), caption: it.name })).filter((p): p is { key: string; src: string; caption: string } => !!p.src).slice(0, 8);
      }
      if (!pictures.length) return null;
      return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {pictures.map((p, i) => (
            <figure key={p.key} className={`group relative overflow-hidden bg-[var(--st-surface)] ${i === 0 && pictures.length > 4 ? "md:col-span-2 md:row-span-2" : ""}`} style={{ borderRadius: "var(--st-radius)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt={p.caption} className="aspect-square h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
              {p.caption && <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-sm text-white opacity-0 transition group-hover:opacity-100">{p.caption}</figcaption>}
            </figure>
          ))}
        </div>
      );
    }

    case "testimonials": {
      const items = rows(d.items).filter((r) => s(r.quote));
      if (!items.length) return null;
      return (
        <div className={`grid gap-5 ${items.length > 1 ? "md:grid-cols-2" : "max-w-2xl"} ${items.length >= 3 ? "lg:grid-cols-3" : ""}`}>
          {items.map((r, i) => (
            <figure key={i} className="st-panel flex flex-col gap-4 p-6">
              <span className="st-heading text-5xl leading-none text-[var(--accent)]" aria-hidden="true">&ldquo;</span>
              <blockquote className="-mt-4 flex-1 leading-relaxed">{s(r.quote)}</blockquote>
              {(s(r.name) || s(r.role)) && (
                <figcaption className="text-sm">
                  <span className="font-semibold">{s(r.name)}</span>
                  {s(r.role) && <span className="block text-[var(--st-muted)]">{s(r.role)}</span>}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      );
    }

    case "cta": {
      if (!s(d.headline)) return null;
      return (
        <div className="st-stripes">
          <div className={`${INNER} flex flex-col items-center gap-5 py-16 text-center md:py-20`}>
            <h2 className="max-w-3xl text-3xl leading-tight sm:text-5xl">{s(d.headline)}</h2>
            {s(d.text) && <p className="max-w-2xl text-lg opacity-90">{s(d.text)}</p>}
            <div className="pt-2 [&_.st-btn-outline]:border-[var(--accent-contrast)]/60">
              <Buttons primary={link(d.primary)} secondary={link(d.secondary)} invert center />
            </div>
          </div>
        </div>
      );
    }

    case "contact":
      return <Contact business={business} site={site} map={d.map === true} />;

    case "text":
      return s(d.body) ? <div className="space-y-4"><PageBody body={s(d.body)} db={db} currentStoreId={store.id} /></div> : null;
  }
}

async function Hero({ section, ctx }: { section: Section; ctx: Ctx }) {
  const d = section.data;
  const { db, store } = ctx;
  const layout = s(d.layout) || "split";
  const photo = img(s(d.image)) ?? img(store.heroImageFileId);
  const art = photo ? null : bannerArtOf(store);
  const headline = s(d.headline) || store.heroHeadline || store.name;
  const text = s(d.text) || store.heroText || store.tagline || "";
  // A live count of open stores, as a bit of proof.
  const open = (await db.store.findMany({ where: { kind: "AFFILIATE", showcase: true, active: true }, select: { opensAt: true, closesAt: true, active: true } })).filter((x) => storeStatus(x).state === "open").length;
  const copy = (o: { invert?: boolean; center?: boolean }) => (
    <div className={`space-y-6 ${o.center ? "mx-auto max-w-3xl text-center" : ""}`}>
      {s(d.eyebrow) && <div className={`text-xs font-semibold tracking-[0.2em] uppercase ${o.invert ? "opacity-85" : "text-[var(--accent)]"}`}>{s(d.eyebrow)}</div>}
      <h1 className="text-4xl leading-[1.05] sm:text-6xl" data-testid="hero-headline">{headline}</h1>
      {text && <p className={`text-lg sm:text-xl ${o.center ? "mx-auto" : ""} max-w-xl ${o.invert ? "opacity-90" : "text-[var(--st-muted)]"}`}>{text}</p>}
      <Buttons primary={link(d.primary)} secondary={link(d.secondary)} center={o.center} invert={o.invert} />
      {open > 0 && (
        <p className={`flex items-center gap-2 text-sm ${o.center ? "justify-center" : ""} ${o.invert ? "opacity-85" : "text-[var(--st-muted)]"}`}>
          <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" /></span>
          {open} team {open === 1 ? "store is" : "stores are"} open right now
        </p>
      )}
    </div>
  );
  const picture = photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
  ) : (
    art && <BannerArt art={art} uid="home-hero" anchor={layout === "split" ? "right" : "center"} />
  );

  if (layout === "cover" && picture) {
    return (
      <div className={`relative overflow-hidden ${photo ? "text-white" : ""}`} data-testid="store-hero">
        {picture}
        <div className={`absolute inset-0 ${photo ? "bg-gradient-to-r from-black/70 via-black/45 to-black/10" : "bg-[radial-gradient(ellipse_60%_70%_at_30%_50%,color-mix(in_srgb,var(--st-bg)_80%,transparent),transparent)]"}`} />
        <div className={`${INNER} relative flex min-h-[34rem] items-center py-20 md:min-h-[40rem]`}>
          <div className={`max-w-2xl ${photo ? "[&_.st-btn-outline]:border-white/70" : ""}`}>{copy({ invert: !!photo })}</div>
        </div>
      </div>
    );
  }
  if (layout === "center" || !picture) {
    return (
      <div className="st-glow" data-testid="store-hero">
        <div className={`${INNER} py-24 md:py-32`}>{copy({ center: true })}</div>
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden" data-testid="store-hero">
      <div className="pointer-events-none absolute -top-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] blur-3xl" />
      <div className={`${INNER} relative grid items-center gap-12 py-16 md:grid-cols-[1.1fr_1fr] md:py-24`}>
        {copy({})}
        <div className="relative aspect-[4/3] overflow-hidden shadow-2xl ring-1 ring-black/5" style={{ borderRadius: "calc(var(--st-radius) * 1.5)" }} data-testid="hero-picture">
          {picture}
        </div>
      </div>
    </div>
  );
}

function Contact({ business, site, map }: { business: Business; site: SiteSettings; map: boolean }) {
  const address = [business.addressLine1, business.addressLine2, [business.city, [business.region, business.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean);
  const socials = (Object.keys(SOCIALS) as SocialKey[]).filter((k) => site.social[k]);
  const mapUrl = address.length ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([business.name, ...address].join(", "))}` : null;
  const block = "st-panel space-y-2 p-6";
  return (
    <div className="grid gap-5 md:grid-cols-3">
      <div className={block}>
        <h3 className="text-xs font-semibold tracking-[0.2em] text-[var(--st-muted)] uppercase">Visit</h3>
        {address.length ? <address className="leading-relaxed not-italic">{address.map((l) => <div key={l}>{l}</div>)}</address> : <p className="text-[var(--st-muted)]">By appointment</p>}
        {map && mapUrl && <a href={mapUrl} target="_blank" rel="noopener" className="inline-block text-sm font-semibold text-[var(--accent)] hover:underline">Get directions →</a>}
      </div>
      <div className={block}>
        <h3 className="text-xs font-semibold tracking-[0.2em] text-[var(--st-muted)] uppercase">Talk to us</h3>
        {business.phone && <a href={`tel:${business.phone.replace(/[^\d+]/g, "")}`} className="block text-lg font-semibold hover:text-[var(--accent)]">{business.phone}</a>}
        {business.email && <a href={`mailto:${business.email}`} className="block break-all hover:text-[var(--accent)]">{business.email}</a>}
        <Link href="/quote" className="inline-block pt-1 text-sm font-semibold text-[var(--accent)] hover:underline">Request a quote →</Link>
      </div>
      <div className={block}>
        <h3 className="text-xs font-semibold tracking-[0.2em] text-[var(--st-muted)] uppercase">{site.hours ? "Hours" : "Follow along"}</h3>
        {site.hours && <p className="whitespace-pre-line leading-relaxed">{site.hours}</p>}
        {socials.length > 0 && <SocialLinks site={site} className="pt-2" />}
        {!site.hours && !socials.length && <p className="text-[var(--st-muted)]">New work every week.</p>}
      </div>
    </div>
  );
}

/** Round buttons to the business's social profiles. */
export function SocialLinks({ site, className = "", size = "h-10 w-10" }: { site: SiteSettings; className?: string; size?: string }) {
  const socials = (Object.keys(SOCIALS) as SocialKey[]).filter((k) => site.social[k]);
  if (!socials.length) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`} data-testid="social-links">
      {socials.map((k) => (
        <a key={k} href={site.social[k]} target="_blank" rel="noopener me" aria-label={SOCIALS[k]} title={SOCIALS[k]} className={`grid ${size} place-items-center rounded-full border border-current/15 transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)]`}>
          <SocialIcon network={k} className="h-4 w-4" />
        </a>
      ))}
    </div>
  );
}
