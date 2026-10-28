// Built-in banner art for store homepages: drawn in SVG from the store's
// theme colors and accent, so it always matches the team or brand. Each
// theme has a default; any store can pick another, upload a photo or have
// none. Pure, so the admin and the storefront share it.
import { type ThemeKey, themeOf } from "./themes";

export type ArtKey = "shapes" | "lines" | "speed" | "field" | "grid" | "aurora" | "deco" | "silk" | "hills" | "topo";

export const ARTS: Record<ArtKey, { label: string; theme: ThemeKey; /** "accent": drawn on the accent color, text goes on top in its contrast color. */ tone: "accent" | "surface" }> = {
  shapes: { label: "Shapes", theme: "minimal", tone: "surface" },
  lines: { label: "Flowing lines", theme: "minimal", tone: "surface" },
  speed: { label: "Speed stripes", theme: "sports", tone: "accent" },
  field: { label: "Game field", theme: "sports", tone: "accent" },
  grid: { label: "Neon grid", theme: "dark", tone: "surface" },
  aurora: { label: "Aurora", theme: "dark", tone: "surface" },
  deco: { label: "Art deco", theme: "luxury", tone: "surface" },
  silk: { label: "Silk", theme: "luxury", tone: "surface" },
  hills: { label: "Hills", theme: "rustic", tone: "surface" },
  topo: { label: "Topo map", theme: "rustic", tone: "surface" },
};

export const DEFAULT_ART: Record<ThemeKey, ArtKey> = { minimal: "shapes", sports: "speed", dark: "grid", luxury: "deco", rustic: "hills" };

export const isArtKey = (k: string | null | undefined): k is ArtKey => !!k && k in ARTS;

/** The art a store's banner shows: its pick, else its theme's; null for none. */
export function bannerArtOf(store: { theme: string | null; heroArt: string | null }): ArtKey | null {
  if (store.heroArt === "none") return null;
  return isArtKey(store.heroArt) ? store.heroArt : DEFAULT_ART[themeOf(store.theme)];
}

/** Arts listed with the store's theme's own first. */
export function artsFor(theme: string | null): ArtKey[] {
  const t = themeOf(theme);
  const keys = Object.keys(ARTS) as ArtKey[];
  return [...keys.filter((k) => ARTS[k].theme === t), ...keys.filter((k) => ARTS[k].theme !== t)];
}
