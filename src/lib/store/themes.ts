// Storefront themes. Each sets the store's colors, fonts and the shape of
// its header, homepage banner and product cards; the store's accent color
// (if set) replaces the theme's. Pure, so the admin preview and the
// storefront share it.

export type ThemeKey = "minimal" | "sports" | "dark" | "luxury" | "rustic";

export type Theme = {
  label: string;
  description: string;
  /** Google Fonts families to load (CSS API v2 `family=` values). */
  fonts: string[];
  heading: string; // CSS font-family
  body: string;
  accent: string; // default accent
  header: "plain" | "bold" | "centered";
  hero: "split" | "stripes" | "glow" | "cover" | "framed";
  vars: Record<string, string>;
};

export const THEMES: Record<ThemeKey, Theme> = {
  minimal: {
    label: "Minimal",
    description: "Clean white space, a modern sans-serif and a split banner. Lets the products do the talking.",
    fonts: ["Inter:wght@400;500;600;700;800"],
    heading: "'Inter', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
    accent: "#111827",
    header: "plain",
    hero: "split",
    vars: {
      "--st-bg": "#ffffff",
      "--st-surface": "#ffffff",
      "--st-subtle": "#f4f4f5",
      "--st-text": "#18181b",
      "--st-muted": "#52525b",
      "--st-faint": "#a1a1aa",
      "--st-border": "#e4e4e7",
      "--st-radius": "0.75rem",
      "--st-heading-weight": "700",
      "--st-heading-transform": "none",
      "--st-heading-tracking": "-0.02em",
      "--st-footer-bg": "#fafafa",
      "--st-footer-text": "#52525b",
    },
  },
  sports: {
    label: "Team / sports",
    description: "Bold condensed capitals, a color-block header and a striped banner in the team color.",
    fonts: ["Oswald:wght@500;600;700", "Inter:wght@400;500;600;700"],
    heading: "'Oswald', 'Arial Narrow', sans-serif",
    body: "'Inter', system-ui, sans-serif",
    accent: "#b91c1c",
    header: "bold",
    hero: "stripes",
    vars: {
      "--st-bg": "#f8fafc",
      "--st-surface": "#ffffff",
      "--st-subtle": "#eef2f7",
      "--st-text": "#0f172a",
      "--st-muted": "#475569",
      "--st-faint": "#94a3b8",
      "--st-border": "#d8dee8",
      "--st-radius": "0.375rem",
      "--st-heading-weight": "700",
      "--st-heading-transform": "uppercase",
      "--st-heading-tracking": "0.02em",
      "--st-footer-bg": "#0f172a",
      "--st-footer-text": "#cbd5e1",
    },
  },
  dark: {
    label: "Dark",
    description: "Near-black with a glowing accent and a geometric typeface. Great for streetwear and esports.",
    fonts: ["Space+Grotesk:wght@400;500;600;700"],
    heading: "'Space Grotesk', system-ui, sans-serif",
    body: "'Space Grotesk', system-ui, sans-serif",
    accent: "#22d3ee",
    header: "plain",
    hero: "glow",
    vars: {
      "--st-bg": "#0b0b10",
      "--st-surface": "#15151d",
      "--st-subtle": "#1d1d27",
      "--st-text": "#f4f4f5",
      "--st-muted": "#a1a1aa",
      "--st-faint": "#71717a",
      "--st-border": "#2a2a36",
      "--st-radius": "0.875rem",
      "--st-heading-weight": "700",
      "--st-heading-transform": "none",
      "--st-heading-tracking": "-0.01em",
      "--st-footer-bg": "#08080c",
      "--st-footer-text": "#a1a1aa",
    },
  },
  luxury: {
    label: "Luxury",
    description: "Ivory and gold, serif headings, generous spacing and square corners.",
    fonts: ["Cormorant+Garamond:wght@500;600;700", "Montserrat:wght@400;500;600"],
    heading: "'Cormorant Garamond', Georgia, serif",
    body: "'Montserrat', system-ui, sans-serif",
    accent: "#a07c45",
    header: "centered",
    hero: "cover",
    vars: {
      "--st-bg": "#fbf9f5",
      "--st-surface": "#fffdf9",
      "--st-subtle": "#f3eee5",
      "--st-text": "#1c1917",
      "--st-muted": "#6b625a",
      "--st-faint": "#a8a29e",
      "--st-border": "#e7dfd2",
      "--st-radius": "0",
      "--st-heading-weight": "600",
      "--st-heading-transform": "none",
      "--st-heading-tracking": "0.01em",
      "--st-footer-bg": "#f3eee5",
      "--st-footer-text": "#6b625a",
    },
  },
  rustic: {
    label: "Local / rustic",
    description: "Warm paper tones, slab-serif headings and earthy colors. Made for breweries, farms and main-street shops.",
    fonts: ["Bitter:wght@500;600;700", "Lora:wght@400;500;600"],
    heading: "'Bitter', Georgia, serif",
    body: "'Lora', Georgia, serif",
    accent: "#8a4b2a",
    header: "plain",
    hero: "framed",
    vars: {
      "--st-bg": "#f6efe3",
      "--st-surface": "#fffaf1",
      "--st-subtle": "#efe5d4",
      "--st-text": "#33261d",
      "--st-muted": "#6b5848",
      "--st-faint": "#a08d7b",
      "--st-border": "#dccbb1",
      "--st-radius": "0.5rem",
      "--st-heading-weight": "700",
      "--st-heading-transform": "none",
      "--st-heading-tracking": "0",
      "--st-footer-bg": "#ece0cb",
      "--st-footer-text": "#5c4a3b",
    },
  },
};

export const themeOf = (key: string | null | undefined): ThemeKey => (key && key in THEMES ? (key as ThemeKey) : "minimal");

const HEX = /^#[0-9a-f]{6}$/i;

/** Black or white text, whichever reads better on `hex`. */
export function contrastText(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? "#111111" : "#ffffff";
}

/** The CSS variables for a store: its theme's, with its own accent color. */
export function themeStyle(key: string | null | undefined, accentColor: string | null | undefined): Record<string, string> {
  const t = THEMES[themeOf(key)];
  const accent = accentColor && HEX.test(accentColor) ? accentColor : t.accent;
  return {
    ...t.vars,
    "--accent": accent,
    "--accent-contrast": contrastText(accent),
    "--st-font-heading": t.heading,
    "--st-font-body": t.body,
  };
}

/** The stylesheet URL for a theme's fonts. */
export const themeFontsUrl = (key: string | null | undefined) => `https://fonts.googleapis.com/css2?${THEMES[themeOf(key)].fonts.map((f) => `family=${f}`).join("&")}&display=swap`;
