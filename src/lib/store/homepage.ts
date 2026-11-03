// The main site's homepage, built from sections: a banner, services, the
// affiliate store showcase, the shop's own goods, about, how it works, a
// gallery, reviews, a call to action, contact details and free text. Each
// kind lists its fields once, and both the admin editor and the cleaning
// of saved layouts work from that list. Pure, so it's shared by the
// browser editor, the server and the tests.

export type FieldSpec =
  | { key: string; label: string; type: "text"; max?: number; placeholder?: string; hint?: string }
  | { key: string; label: string; type: "textarea"; max?: number; placeholder?: string; hint?: string; markdown?: boolean }
  | { key: string; label: string; type: "number"; min: number; max: number }
  | { key: string; label: string; type: "select"; options: Record<string, string> }
  | { key: string; label: string; type: "toggle"; hint?: string }
  | { key: string; label: string; type: "link"; hint?: string }
  | { key: string; label: string; type: "image"; hint?: string }
  | { key: string; label: string; type: "color"; hint?: string }
  | { key: string; label: string; type: "list"; item: string; max: number; fields: FieldSpec[] };

export type Link = { label: string; href: string };
export type FieldValue = string | number | boolean | Link | null | Record<string, FieldValue>[];
export type Section = { id: string; kind: SectionKind; on: boolean; data: Record<string, FieldValue> };

export const ICONS = {
  shirt: "T-shirt",
  print: "Screen printing",
  needle: "Embroidery",
  press: "Heat press / transfers",
  store: "Online store",
  palette: "Design",
  trophy: "Teams & awards",
  briefcase: "Business",
  gift: "Promo products",
  truck: "Delivery",
  bolt: "Fast turnaround",
  star: "Quality",
  hoodie: "Hoodie",
  hat: "Hat",
  layers: "DTF / transfers",
  sticker: "Vinyl & stickers",
  spark: "Laser engraving",
  ruler: "Sizing",
  clock: "Turnaround time",
  calendar: "Order deadline",
  box: "Packing",
  check: "Approved / checked",
  chat: "Talk to us",
  team: "Team / group",
  school: "School",
  tag: "Price / quote",
  pin: "Local / pickup",
  leaf: "Eco-friendly",
  heart: "Fundraiser",
} as const;
export type IconKey = keyof typeof ICONS;
const ICON_OR_NONE = { none: "No icon", ...ICONS };

/** A section's background: "auto" alternates plain and tinted down the page. */
export const BANDS = { auto: "Automatic", plain: "Plain", tint: "Tinted with the color", accent: "Solid color", dark: "Dark" } as const;
export type BandKey = keyof typeof BANDS;

/** How stores look in a showcase. */
export const CARD_STYLES = { photo: "Photo card (the store's card picture)", logo: "Logo on the store's color", products: "Logo with product photos", list: "Compact list" } as const;
export type CardStyle = keyof typeof CARD_STYLES;

const heading = (placeholder: string): FieldSpec => ({ key: "title", label: "Heading", type: "text", max: 100, placeholder });
const intro: FieldSpec = { key: "intro", label: "Intro", type: "textarea", max: 400 };

export const SECTION_KINDS = {
  hero: {
    label: "Banner",
    description: "The big welcome at the top: headline, a line about you, two buttons and a photo.",
    anchor: null,
    fields: [
      { key: "eyebrow", label: "Small line above", type: "text", max: 60, placeholder: "Screen printing · Embroidery · Team stores" },
      { key: "headline", label: "Headline", type: "text", max: 120 },
      { key: "text", label: "Text", type: "textarea", max: 300 },
      { key: "primary", label: "Main button", type: "link" },
      { key: "secondary", label: "Second button", type: "link" },
      { key: "layout", label: "Layout", type: "select", options: { split: "Text beside the picture", cover: "Text over the picture", center: "Centered, no picture" } },
      { key: "image", label: "Picture", type: "image", hint: "Your shop, a press run, finished work. Without one, the main banner photo or art is used." },
    ],
  },
  logos: {
    label: "Trusted by",
    description: "A strip of your affiliate stores' logos, picked up automatically.",
    anchor: null,
    fields: [heading("Proud to print for"), { key: "limit", label: "Logos", type: "number", min: 3, max: 18 }],
  },
  stats: {
    label: "Numbers",
    description: "A few big numbers: years in business, shirts printed, teams served.",
    anchor: null,
    fields: [
      {
        key: "items",
        label: "Numbers",
        type: "list",
        item: "number",
        max: 6,
        fields: [
          { key: "icon", label: "Icon", type: "select", options: ICON_OR_NONE },
          { key: "value", label: "Number", type: "text", max: 20, placeholder: "25,000+" },
          { key: "label", label: "Label", type: "text", max: 60, placeholder: "Shirts printed last year" },
        ],
      },
    ],
  },
  services: {
    label: "Services",
    description: "What you do, as cards with an icon, a line or two and an optional link.",
    anchor: "services",
    fields: [
      heading("What we do"),
      intro,
      {
        key: "items",
        label: "Services",
        type: "list",
        item: "service",
        max: 9,
        fields: [
          { key: "icon", label: "Icon", type: "select", options: ICONS },
          { key: "title", label: "Name", type: "text", max: 60 },
          { key: "text", label: "Description", type: "textarea", max: 240 },
          { key: "link", label: "Link", type: "link", hint: "Optional" },
        ],
      },
    ],
  },
  stores: {
    label: "Team & group stores",
    description: "Your affiliate stores as cards, with a search box so people find theirs.",
    anchor: "stores",
    fields: [
      heading("Find your team store"),
      intro,
      { key: "group", label: "Only this store group", type: "text", max: 60, hint: "Blank = every store shown in showcases" },
      { key: "sort", label: "Order", type: "select", options: { newest: "Newest", sales: "Highest sales", closing: "Closing soon", name: "Name" } },
      { key: "card", label: "Card style", type: "select", options: CARD_STYLES },
      { key: "limit", label: "Stores", type: "number", min: 2, max: 24 },
      { key: "search", label: "Search box", type: "toggle" },
    ],
  },
  shop: {
    label: "Shop",
    description: "Your own goods for sale on the main site.",
    anchor: "shop",
    fields: [heading("Shop our goods"), intro, { key: "limit", label: "Items", type: "number", min: 2, max: 16 }, { key: "featuredOnly", label: "Featured items only", type: "toggle" }],
  },
  about: {
    label: "About",
    description: "Your story, with a photo and a few points that set you apart.",
    anchor: "about",
    fields: [
      heading("About us"),
      { key: "body", label: "Text", type: "textarea", max: 3000, markdown: true },
      { key: "points", label: "Points", type: "list", item: "point", max: 6, fields: [{ key: "text", label: "Point", type: "text", max: 100 }] },
      { key: "image", label: "Photo", type: "image" },
    ],
  },
  steps: {
    label: "How it works",
    description: "Ordering in a few numbered steps.",
    anchor: "how-it-works",
    fields: [
      heading("How it works"),
      {
        key: "items",
        label: "Steps",
        type: "list",
        item: "step",
        max: 6,
        fields: [
          { key: "title", label: "Step", type: "text", max: 60 },
          { key: "text", label: "Description", type: "textarea", max: 240 },
        ],
      },
    ],
  },
  gallery: {
    label: "Our work",
    description: "Photos of finished jobs. Without any, your store items' pictures are shown.",
    anchor: "work",
    fields: [heading("Recent work"), intro, { key: "images", label: "Photos", type: "list", item: "photo", max: 12, fields: [{ key: "image", label: "Photo", type: "image" }, { key: "caption", label: "Caption", type: "text", max: 80 }] }],
  },
  features: {
    label: "Highlights",
    description: "A strip of icons with short promises: fast turnaround, proof before print, local pickup.",
    anchor: null,
    fields: [
      heading(""),
      {
        key: "items",
        label: "Highlights",
        type: "list",
        item: "highlight",
        max: 6,
        fields: [
          { key: "icon", label: "Icon", type: "select", options: ICONS },
          { key: "title", label: "Highlight", type: "text", max: 50, placeholder: "Proof before print" },
          { key: "text", label: "Small print", type: "text", max: 90 },
        ],
      },
    ],
  },
  timeline: {
    label: "Turnaround timeline",
    description: "An infographic of an order from artwork to pickup, day by day.",
    anchor: "turnaround",
    fields: [
      heading("From artwork to your door"),
      intro,
      {
        key: "items",
        label: "Stages",
        type: "list",
        item: "stage",
        max: 7,
        fields: [
          { key: "when", label: "When", type: "text", max: 24, placeholder: "Day 1" },
          { key: "icon", label: "Icon", type: "select", options: ICONS },
          { key: "title", label: "Stage", type: "text", max: 50 },
          { key: "text", label: "Description", type: "text", max: 140 },
        ],
      },
      { key: "note", label: "Note below", type: "text", max: 160, placeholder: "Need it sooner? Ask about rush orders." },
    ],
  },
  methods: {
    label: "Decoration methods",
    description: "Compare screen printing, embroidery, transfers and more: what each is best for, minimums, turnaround, and rating bars.",
    anchor: "methods",
    fields: [
      heading("Which decoration is right for you?"),
      intro,
      {
        key: "items",
        label: "Methods",
        type: "list",
        item: "method",
        max: 6,
        fields: [
          { key: "icon", label: "Icon", type: "select", options: ICONS },
          { key: "name", label: "Method", type: "text", max: 40 },
          { key: "bestFor", label: "Best for", type: "text", max: 80 },
          { key: "minimum", label: "Minimum", type: "text", max: 30, placeholder: "24 pieces" },
          { key: "turnaround", label: "Turnaround", type: "text", max: 30, placeholder: "7–10 days" },
          { key: "cost", label: "Cost", type: "select", options: { "": "Don't show", $: "$ (lowest per piece)", $$: "$$", $$$: "$$$" } },
          { key: "durability", label: "Durability (1–5)", type: "number", min: 1, max: 5 },
          { key: "detail", label: "Fine detail & color (1–5)", type: "number", min: 1, max: 5 },
        ],
      },
    ],
  },
  testimonials: {
    label: "Reviews",
    description: "What customers say about you.",
    anchor: "reviews",
    fields: [
      heading("What customers say"),
      {
        key: "items",
        label: "Reviews",
        type: "list",
        item: "review",
        max: 6,
        fields: [
          { key: "quote", label: "Quote", type: "textarea", max: 400 },
          { key: "name", label: "Name", type: "text", max: 60 },
          { key: "role", label: "Team or business", type: "text", max: 80 },
        ],
      },
    ],
  },
  cta: {
    label: "Call to action",
    description: "A bold band asking visitors to get started.",
    anchor: null,
    fields: [
      { key: "headline", label: "Headline", type: "text", max: 120 },
      { key: "text", label: "Text", type: "textarea", max: 300 },
      { key: "primary", label: "Main button", type: "link" },
      { key: "secondary", label: "Second button", type: "link" },
    ],
  },
  contact: {
    label: "Contact",
    description: "Address, phone, email, hours, a map link and your social links (from Site details).",
    anchor: "contact",
    fields: [heading("Visit or get in touch"), intro, { key: "map", label: "Map link", type: "toggle", hint: "Opens the address in Google Maps" }],
  },
  text: {
    label: "Free text",
    description: "Anything else, in Markdown. Store showcase and item lines work here too.",
    anchor: null,
    fields: [heading(""), { key: "body", label: "Text", type: "textarea", max: 6000, markdown: true }],
  },
} satisfies Record<string, { label: string; description: string; anchor: string | null; fields: FieldSpec[] }>;

export type SectionKind = keyof typeof SECTION_KINDS;
export const SECTION_KEYS = Object.keys(SECTION_KINDS) as SectionKind[];
export const isSectionKind = (k: unknown): k is SectionKind => typeof k === "string" && k in SECTION_KINDS;

/** Sections a homepage may have only once (the rest can repeat). */
export const SINGLE: SectionKind[] = ["hero", "contact"];

/** Sections that list other stores, for the main site only. */
const MAIN_ONLY: SectionKind[] = ["logos", "stores"];
/** The kinds of section a store's homepage can use. */
export const kindsFor = (storeKind: string | null | undefined): SectionKind[] => (storeKind === "AFFILIATE" ? SECTION_KEYS.filter((k) => !MAIN_ONLY.includes(k)) : SECTION_KEYS);

/** Background and color, which every section has (the banner, just the color). */
const BAND_FIELD: FieldSpec = { key: "bg", label: "Background", type: "select", options: BANDS };
const COLOR_FIELD: FieldSpec = { key: "color", label: "Section color", type: "color", hint: "Blank = the store's accent color" };
/** All of a section's fields: its own, then its background and color. */
export const fieldsOf = (kind: SectionKind): FieldSpec[] => [...SECTION_KINDS[kind].fields, ...(kind === "hero" ? [] : [BAND_FIELD]), COLOR_FIELD];

// ─── Site-wide details ──────────────────────────────────────────────────

export const SOCIALS = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  x: "X (Twitter)",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
  google: "Google reviews",
} as const;
export type SocialKey = keyof typeof SOCIALS;

export type SiteSettings = {
  social: Partial<Record<SocialKey, string>>;
  /** Opening hours, a line per day or range. */
  hours: string;
  /** The button at the right of the header. */
  headerButton: Link;
  /** Show the "Team stores" directory link in the menu. */
  storesLink: boolean;
};

export const DEFAULT_SITE: SiteSettings = { social: {}, hours: "", headerButton: { label: "Get a quote", href: "/quote" }, storesLink: true };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** A web address, a path on the site, a #section, mailto: or tel:; anything else is dropped. */
export function cleanHref(v: unknown): string {
  const s = str(v, 500);
  if (!s) return "";
  if (/^(\/|#|mailto:|tel:)/i.test(s) && !s.startsWith("//")) return s;
  if (/^https?:\/\/[^\s]+$/i.test(s)) return s;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(s)) return `https://${s}`;
  return "";
}

const cleanLink = (v: unknown): Link => {
  const o = (v ?? {}) as Record<string, unknown>;
  const href = cleanHref(o.href);
  return { label: href ? str(o.label, 40) : "", href: str(o.label, 40) ? href : "" };
};

export function parseSite(raw: unknown): SiteSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const social: SiteSettings["social"] = {};
  const rawSocial = (o.social ?? {}) as Record<string, unknown>;
  for (const k of Object.keys(SOCIALS) as SocialKey[]) {
    const href = cleanHref(rawSocial[k]);
    if (href.startsWith("http")) social[k] = href;
  }
  const button = o.headerButton === undefined ? DEFAULT_SITE.headerButton : cleanLink(o.headerButton);
  return { social, hours: str(o.hours, 600), headerButton: button, storesLink: o.storesLink === undefined ? true : o.storesLink === true };
}

// ─── Cleaning saved sections ────────────────────────────────────────────

function cleanField(spec: FieldSpec, v: unknown): FieldValue {
  switch (spec.type) {
    case "text":
    case "textarea":
      return str(v, spec.max ?? 1000);
    case "number": {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(spec.max, Math.max(spec.min, Math.round(n))) : spec.min;
    }
    case "select":
      return typeof v === "string" && v in spec.options ? v : Object.keys(spec.options)[0];
    case "toggle":
      return v === true;
    case "link":
      return cleanLink(v);
    case "image":
      return typeof v === "string" && /^[a-z0-9]{10,40}$/i.test(v) ? v : null;
    case "color":
      return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : "";
    case "list":
      return (Array.isArray(v) ? v : [])
        .slice(0, spec.max)
        .map((row) => cleanData(spec.fields, row) as Record<string, FieldValue>)
        // A row with nothing typed in (just its icon or the like) is dropped.
        .filter((row) => spec.fields.some((f) => hasContent(f, row[f.key])));
  }
}

function hasContent(spec: FieldSpec, v: FieldValue): boolean {
  if (spec.type === "text" || spec.type === "textarea" || spec.type === "image") return !!v;
  if (spec.type === "link") return !!(v as Link).href;
  if (spec.type === "list") return Array.isArray(v) && v.length > 0;
  return false;
}

function cleanData(fields: FieldSpec[], raw: unknown): Record<string, FieldValue> {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries(fields.map((f) => [f.key, cleanField(f, o[f.key])]));
}

let counter = 0;
/** A short id for a new section. */
export const newSectionId = (kind: string) => `${kind}-${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Saved sections, cleaned: known kinds (that the store may use), their known fields, single sections once, at most 30. */
export function parseSections(raw: unknown, storeKind?: string | null): Section[] {
  if (!Array.isArray(raw)) return [];
  const allowed = kindsFor(storeKind);
  const seen = new Set<string>();
  const out: Section[] = [];
  for (const r of raw.slice(0, 30)) {
    const o = (r ?? {}) as Record<string, unknown>;
    if (!isSectionKind(o.kind) || !allowed.includes(o.kind)) continue;
    if (SINGLE.includes(o.kind) && out.some((s) => s.kind === o.kind)) continue;
    let id = typeof o.id === "string" && /^[\w-]{1,60}$/.test(o.id) ? o.id : `${o.kind}-${out.length}`;
    if (seen.has(id)) id = `${id}-${out.length}`;
    seen.add(id);
    out.push({ id, kind: o.kind, on: o.on !== false, data: cleanData(fieldsOf(o.kind), o.data) });
  }
  return out;
}

/** A new section of a kind, with sensible starting content. */
export function blankSection(kind: SectionKind, id = newSectionId(kind)): Section {
  const fields = fieldsOf(kind);
  const data = cleanData(fields, STARTERS[kind] ?? {});
  // Lists start with one empty row to fill in (dropped on save if left empty).
  for (const f of fields) if (f.type === "list" && Array.isArray(data[f.key]) && !(data[f.key] as Rows).length) data[f.key] = [blankRow(f.fields)];
  return { id, kind, on: true, data };
}

type Rows = Record<string, FieldValue>[];

/** An empty row of a list. */
export const blankRow = (fields: FieldSpec[]): Record<string, FieldValue> =>
  Object.fromEntries(fields.map((f) => [f.key, f.type === "select" ? Object.keys(f.options)[0] : f.type === "link" ? { label: "", href: "" } : f.type === "toggle" ? false : f.type === "image" ? null : f.type === "color" ? "" : f.type === "number" ? f.min : f.type === "list" ? [] : ""]));

/** Uploaded pictures a homepage uses (so the site may serve them). */
export function sectionImages(sections: Section[]): string[] {
  const ids: string[] = [];
  const walk = (fields: FieldSpec[], data: Record<string, FieldValue>) => {
    for (const f of fields) {
      const v = data[f.key];
      if (f.type === "image" && typeof v === "string") ids.push(v);
      if (f.type === "list" && Array.isArray(v)) v.forEach((row) => walk(f.fields, row));
    }
  };
  for (const s of sections) walk(fieldsOf(s.kind), s.data);
  return ids;
}

/** Where each section can be linked to (#services), for the menu: the first of each kind that's shown. */
export function sectionAnchors(sections: Section[]): Map<string, string> {
  const anchors = new Map<string, string>();
  for (const s of sections) {
    const a = SECTION_KINDS[s.kind].anchor;
    if (s.on && a && !anchors.has(s.id) && ![...anchors.values()].includes(a)) anchors.set(s.id, a);
  }
  return anchors;
}

// ─── Starting content ───────────────────────────────────────────────────

const STARTERS: Partial<Record<SectionKind, Record<string, unknown>>> = {
  hero: { layout: "split", primary: { label: "Start a quote", href: "/quote" }, secondary: { label: "Find your team store", href: "/stores" } },
  logos: { title: "Proud to print for", limit: 12 },
  stats: { items: [{ value: "", label: "" }] },
  services: {
    title: "What we do",
    intro: "From a dozen shirts to a whole league, it's all made in our own shop.",
    items: [
      { icon: "print", title: "Screen printing", text: "Bold, durable prints for runs of 12 to 10,000, matched to your colors." },
      { icon: "needle", title: "Embroidery", text: "Polos, hats and jackets stitched in-house for a finish that lasts." },
      { icon: "store", title: "Team & group stores", text: "Your own online store: members order and pay, we print it all in one batch.", link: { label: "Find a store", href: "/stores" } },
      { icon: "palette", title: "Design help", text: "Send a sketch or an old logo and we'll get it print-ready." },
    ],
  },
  stores: { title: "Find your team store", intro: "Teams, schools, clubs and businesses order their gear through their own online store.", card: "photo", sort: "newest", limit: 8, search: true },
  features: {
    items: [
      { icon: "bolt", title: "Fast turnaround", text: "Most orders ready in about 10 business days" },
      { icon: "check", title: "Proof before print", text: "Nothing is printed until you approve it" },
      { icon: "store", title: "Free team stores", text: "Members order and pay online" },
      { icon: "pin", title: "Local pickup", text: "Or we deliver" },
    ],
  },
  timeline: {
    title: "From artwork to your door",
    intro: "Here's how a typical order runs, from the day you send artwork.",
    items: [
      { when: "Day 1", icon: "chat", title: "Order & artwork", text: "Pick garments and send your logo, or ask us to design it." },
      { when: "Day 2", icon: "check", title: "Proof approved", text: "You approve a mockup before anything is printed." },
      { when: "Days 3–8", icon: "print", title: "Printed & stitched", text: "Made in our own shop, on our own presses." },
      { when: "Day 9", icon: "box", title: "Checked & packed", text: "Every piece checked, folded and sorted by name." },
      { when: "Day 10", icon: "truck", title: "Ready", text: "Pick it up or have it delivered." },
    ],
    note: "Need it sooner? Ask about rush orders.",
  },
  methods: {
    title: "Which decoration is right for you?",
    intro: "Every method has its strengths. Not sure? We'll recommend one with your quote.",
    items: [
      { icon: "print", name: "Screen printing", bestFor: "Bold designs and bigger runs", minimum: "24 pieces", turnaround: "7–10 days", cost: "$", durability: 5, detail: 3 },
      { icon: "needle", name: "Embroidery", bestFor: "Polos, hats and jackets", minimum: "12 pieces", turnaround: "7–10 days", cost: "$$", durability: 5, detail: 3 },
      { icon: "layers", name: "DTF transfers", bestFor: "Full-color art, small runs", minimum: "1 piece", turnaround: "3–5 days", cost: "$$", durability: 4, detail: 5 },
      { icon: "sticker", name: "Vinyl", bestFor: "Names, numbers and simple logos", minimum: "1 piece", turnaround: "2–4 days", cost: "$$", durability: 4, detail: 2 },
    ],
  },
  shop: { title: "Shop our goods", limit: 8 },
  steps: {
    title: "How it works",
    items: [
      { title: "Tell us what you need", text: "Pick garments and send your artwork, or ask us to design it." },
      { title: "Approve your proof", text: "We send a mockup to approve before anything is printed." },
      { title: "We print it", text: "Everything is made in our own shop, checked and folded." },
      { title: "Pick up or ship", text: "Collect it from us or have it delivered." },
    ],
  },
  gallery: { title: "Recent work", images: [] },
  testimonials: { title: "What customers say", items: [{ quote: "", name: "", role: "" }] },
  cta: { headline: "Ready to get started?", text: "Tell us what you have in mind and we'll get back to you with a quote.", primary: { label: "Request a quote", href: "/quote" }, secondary: { label: "Browse the catalog", href: "/catalog" } },
  contact: { title: "Visit or get in touch", map: true },
};

/** The homepage until the business builds its own. */
export function defaultSections(business: { name: string; city?: string | null }, tagline: string | null): Section[] {
  const where = business.city ? ` in ${business.city}` : "";
  const s = (kind: SectionKind, data: Record<string, unknown> = {}) => {
    const blank = blankSection(kind, kind);
    return { ...blank, data: cleanData(fieldsOf(kind), { ...(STARTERS[kind] ?? {}), ...data }) };
  };
  return [
    s("hero", {
      eyebrow: "Screen printing · Embroidery · Team stores",
      headline: "Custom apparel, printed right here",
      text: tagline || `${business.name} prints and embroiders shirts, hoodies, hats and more for teams, schools and businesses${where}.`,
    }),
    s("logos"),
    s("services"),
    s("stores"),
    s("shop"),
    s("steps"),
    s("about", {
      title: "About us",
      body: `${business.name} is an independent print shop${where}. Every order is printed, stitched and checked in our own shop, by people who care how it turns out.`,
      points: [{ text: "Printed in-house, start to finish" }, { text: "Proof approved before we print" }, { text: "No-fuss online stores for teams and groups" }],
    }),
    s("cta"),
    s("contact"),
  ];
}

/** A starting homepage for an affiliate (team, school, business) store. */
export function affiliateSections(store: { name: string; tagline: string | null }): Section[] {
  const s = (kind: SectionKind, data: Record<string, unknown> = {}) => ({ ...blankSection(kind, kind), data: cleanData(fieldsOf(kind), { ...(STARTERS[kind] ?? {}), ...data }) });
  return [
    s("hero", { headline: store.name, text: store.tagline ?? "", layout: "split", primary: { label: "Shop now", href: "/shop" }, secondary: { label: "", href: "" } }),
    s("features", {
      items: [
        { icon: "calendar", title: "Order by the deadline", text: "Everything is printed together after the store closes" },
        { icon: "ruler", title: "Check your size", text: "Size charts are on every item" },
        { icon: "pin", title: "Pickup or delivery", text: "Choose at checkout" },
      ],
    }),
    s("shop", { title: "Shop the collection", limit: 12 }),
    s("steps", {
      title: "How ordering works",
      items: [
        { title: "Pick your gear", text: "Choose items, sizes and any names or numbers." },
        { title: "Order before the store closes", text: "Pay online; you'll get an email receipt." },
        { title: "We print everything together", text: "All orders are made in one batch after the close." },
        { title: "Pick up or get it delivered", text: "We'll let you know when it's ready." },
      ],
    }),
  ];
}

/** A store's homepage sections: its own, else the built-in set for the main site or a team store. */
export const sectionsOf = (store: { homeSections: unknown; tagline: string | null; kind?: string; name?: string }, business: { name: string; city?: string | null }) =>
  store.homeSections != null
    ? parseSections(store.homeSections, store.kind)
    : store.kind === "AFFILIATE"
      ? affiliateSections({ name: store.name ?? business.name, tagline: store.tagline })
      : defaultSections(business, store.tagline);
