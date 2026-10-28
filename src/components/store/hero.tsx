import Link from "next/link";
import type { Store } from "@prisma/client";
import { ARTS, bannerArtOf } from "@/lib/store/banner-art";
import type { Theme } from "@/lib/store/themes";
import { BannerArt } from "./banner-art";

type HeroProps = {
  store: Pick<Store, "name" | "tagline" | "theme" | "heroArt" | "heroHeadline" | "heroText" | "heroButton" | "heroImageFileId">;
  style: Theme["hero"];
  /** "Open · closes Nov 20" and the like. */
  eyebrow: string | null;
};

/** Edge to edge, whatever the page width. */
const BLEED = "relative left-1/2 -mt-8 w-screen -translate-x-1/2 overflow-hidden";

/**
 * The homepage banner: the store's headline, a line of text and a Shop
 * button over (or beside) its banner photo, or the built-in art in the
 * store's colors, laid out the theme's way. The store's products are
 * listed below it, so they aren't repeated here.
 */
export function StoreHero({ store, style, eyebrow }: HeroProps) {
  const headline = store.heroHeadline || store.name;
  const text = store.heroText || store.tagline;
  const button = store.heroButton || "Shop now";
  const image = store.heroImageFileId ? `/media/${store.heroImageFileId}` : null;
  const art = image ? null : bannerArtOf(store);
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
  // The photo or art, filling a positioned box.
  const panel = style === "split" || style === "framed";
  const picture = image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
  ) : (
    art && <BannerArt art={art} uid="hero" anchor={panel ? "right" : "center"} />
  );

  // Text beside a picture: "split" (minimal) and "framed" (rustic).
  if (panel) {
    const framed = style === "framed";
    const box = framed ? (
      <div className="rotate-1 bg-white p-3 pb-8 shadow-lg">
        <div className="relative aspect-[4/3] overflow-hidden" data-testid="hero-picture">{picture}</div>
      </div>
    ) : (
      <div className="relative aspect-[4/3] overflow-hidden" style={{ borderRadius: "var(--st-radius)" }} data-testid="hero-picture">{picture}</div>
    );
    const body = (
      <div className={`grid items-center gap-10 ${picture ? "md:grid-cols-2" : ""}`}>
        {copy({ size: framed ? undefined : "text-5xl sm:text-6xl" })}
        {picture && box}
      </div>
    );
    return framed ? (
      <section className="st-paper -mt-2 border-4 border-double border-[var(--st-border)] p-8 md:p-12" style={{ borderRadius: "var(--st-radius)" }} data-testid="store-hero">{body}</section>
    ) : (
      <section className="py-6 md:py-10" data-testid="store-hero">{body}</section>
    );
  }

  // Text over a full-width picture: "stripes" (team), "glow" (dark) and "cover" (luxury).
  const center = style !== "stripes";
  // White text on photos (with a shade), the accent's contrast color on accent art and the plain team banner.
  const onAccent = (art && ARTS[art].tone === "accent") || (!picture && style === "stripes");
  const invert = !!image || onAccent;
  const plain = style === "stripes" ? "st-stripes" : style === "glow" ? "st-glow" : "bg-[var(--st-subtle)]";
  const scrim = image
    ? "bg-black/45"
    : onAccent
      ? center
        ? ""
        : "bg-[linear-gradient(90deg,color-mix(in_srgb,var(--accent)_75%,transparent),transparent_65%)]"
      : "bg-[radial-gradient(ellipse_50%_60%_at_50%_50%,color-mix(in_srgb,var(--st-bg)_70%,transparent),transparent)]";
  return (
    <section
      className={`${BLEED} ${picture ? "" : plain} border-b border-[var(--st-border)] ${image ? "text-white" : onAccent ? "text-[var(--accent-contrast)]" : ""}`}
      data-testid="store-hero"
      data-art={art ?? (image ? "photo" : "none")}
    >
      {picture}
      {picture && scrim && <div className={`absolute inset-0 ${scrim}`} />}
      <div className={`relative mx-auto flex min-h-[24rem] max-w-6xl items-center px-4 py-16 md:min-h-[30rem] md:py-20 ${center ? "justify-center" : ""}`}>
        <div className={center ? "max-w-3xl" : "max-w-2xl"}>{copy({ center, invert, size: style === "stripes" ? "text-5xl sm:text-7xl" : "text-5xl sm:text-6xl" })}</div>
      </div>
    </section>
  );
}
