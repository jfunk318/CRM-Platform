import Link from "next/link";
import type { Store } from "@prisma/client";
import type { Theme } from "@/lib/store/themes";

type HeroProps = {
  store: Pick<Store, "name" | "tagline" | "heroHeadline" | "heroText" | "heroButton" | "heroImageFileId">;
  style: Theme["hero"];
  /** Product pictures (mockups) for a collage when there's no banner image. */
  pictures: { src: string; alt: string }[];
  /** "Open · closes Nov 20" and the like. */
  eyebrow: string | null;
};

/** Edge to edge, whatever the page width. */
const BLEED = "relative left-1/2 -mt-8 w-screen -translate-x-1/2";

/**
 * The homepage banner: the store's headline, a line of text and a Shop
 * button, with its banner image or (until one's uploaded) a collage of its
 * own products, laid out the theme's way.
 */
export function StoreHero({ store, style, pictures, eyebrow }: HeroProps) {
  const headline = store.heroHeadline || store.name;
  const text = store.heroText || store.tagline;
  const button = store.heroButton || "Shop now";
  const image = store.heroImageFileId ? `/media/${store.heroImageFileId}` : null;
  const pics = pictures.slice(0, 3);
  const copy = (o: { center?: boolean; invert?: boolean; size?: string }) => (
    <div className={`space-y-5 ${o.center ? "text-center" : ""}`}>
      {eyebrow && <div className={`text-xs font-semibold tracking-[0.2em] uppercase ${o.invert ? "opacity-80" : "text-[var(--accent)]"}`}>{eyebrow}</div>}
      <h1 className={`${o.size ?? "text-4xl sm:text-5xl"} leading-[1.05]`} data-testid="hero-headline">{headline}</h1>
      {text && <p className={`max-w-xl text-lg ${o.center ? "mx-auto" : ""} ${o.invert ? "opacity-90" : "text-[var(--st-muted)]"}`}>{text}</p>}
      <div className={o.center ? "flex justify-center" : ""}>
        <Link href="/shop" className={o.invert ? "st-btn !bg-[var(--accent-contrast)] !text-[var(--accent)]" : "st-btn"} data-testid="hero-button">
          {button}
        </Link>
      </div>
    </div>
  );

  if (style === "stripes") {
    return (
      <section className={`${BLEED} st-stripes`} data-testid="store-hero">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
          {copy({ invert: true, size: "text-5xl sm:text-7xl" })}
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="aspect-[4/3] w-full rounded-md object-cover shadow-2xl" />
          ) : (
            <div className="relative h-72 md:h-80">
              {pics.map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={p.src}
                  src={p.src}
                  alt={p.alt}
                  className="absolute h-56 w-56 rounded-md bg-white object-cover shadow-2xl ring-4 ring-white md:h-64 md:w-64"
                  style={{ left: `${i * 22}%`, top: `${[8, 0, 14][i]}%`, rotate: `${[-6, 3, 9][i]}deg`, zIndex: 3 - i }}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  if (style === "glow") {
    return (
      <section className={`${BLEED} st-glow border-b border-[var(--st-border)]`} data-testid="store-hero">
        <div className="mx-auto max-w-6xl space-y-10 px-4 py-16 md:py-24">
          {copy({ center: true, size: "text-5xl sm:text-6xl" })}
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="mx-auto max-h-96 w-full rounded-2xl object-cover ring-1 ring-[var(--st-border)]" />
          ) : (
            <div className="mx-auto grid max-w-3xl grid-cols-3 gap-4">
              {pics.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.src} src={p.src} alt={p.alt} className="aspect-square w-full rounded-2xl bg-white object-cover ring-1 ring-[var(--st-border)] shadow-[0_20px_60px_-20px_var(--accent)]" />
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  if (style === "cover") {
    return image ? (
      <section className={`${BLEED} h-[28rem] md:h-[34rem]`} data-testid="store-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative mx-auto flex h-full max-w-3xl items-center px-4 text-white">{copy({ center: true, invert: true, size: "text-5xl sm:text-6xl" })}</div>
      </section>
    ) : (
      <section className={`${BLEED} border-b border-[var(--st-border)] bg-[var(--st-subtle)]`} data-testid="store-hero">
        <div className="mx-auto max-w-5xl space-y-10 px-4 py-16 md:py-20">
          <div className="mx-auto h-px w-16 bg-[var(--accent)]" />
          {copy({ center: true, size: "text-5xl sm:text-6xl" })}
          <div className="mx-auto grid max-w-3xl grid-cols-3 gap-6">
            {pics.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.src} src={p.src} alt={p.alt} className="aspect-[4/5] w-full border border-[var(--st-border)] bg-white object-cover p-2" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (style === "framed") {
    return (
      <section className="st-paper -mt-2 border-4 border-double border-[var(--st-border)] p-8 md:p-12" style={{ borderRadius: "var(--st-radius)" }} data-testid="store-hero">
        <div className="grid items-center gap-10 md:grid-cols-2">
          {copy({})}
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="w-full rotate-1 bg-white object-cover p-3 shadow-lg" />
          ) : (
            <div className="flex justify-center gap-3">
              {pics.slice(0, 2).map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.src} src={p.src} alt={p.alt} className="w-1/2 bg-white object-cover p-2 pb-6 shadow-lg" style={{ rotate: `${i ? 3 : -3}deg` }} />
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  // "split": text on the left, picture or a tidy grid of products on the right.
  return (
    <section className="grid items-center gap-10 py-6 md:grid-cols-2 md:py-10" data-testid="store-hero">
      {copy({ size: "text-5xl sm:text-6xl" })}
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="aspect-[4/3] w-full object-cover" style={{ borderRadius: "var(--st-radius)" }} />
      ) : (
        <div className="grid grid-cols-3 grid-rows-2 gap-3">
          {pics.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.src} src={p.src} alt={p.alt} className={`aspect-square h-full w-full bg-[var(--st-subtle)] object-cover ${i === 0 ? "col-span-2 row-span-2" : ""}`} style={{ borderRadius: "var(--st-radius)" }} />
          ))}
        </div>
      )}
    </section>
  );
}
