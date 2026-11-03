import { describe, expect, it } from "vitest";
import { affiliateSections, blankSection, cleanHref, defaultSections, kindsFor, parseSections, parseSite, sectionAnchors, sectionImages, sectionsOf } from "./homepage";

describe("cleanHref", () => {
  it("keeps site paths, anchors, mail and phone links and web addresses", () => {
    expect(cleanHref("/quote")).toBe("/quote");
    expect(cleanHref("#contact")).toBe("#contact");
    expect(cleanHref("mailto:a@b.co")).toBe("mailto:a@b.co");
    expect(cleanHref("tel:+16035550100")).toBe("tel:+16035550100");
    expect(cleanHref("https://instagram.com/x")).toBe("https://instagram.com/x");
  });
  it("adds https to bare domains and drops anything unsafe", () => {
    expect(cleanHref("instagram.com/jakes")).toBe("https://instagram.com/jakes");
    expect(cleanHref("javascript:alert(1)")).toBe("");
    expect(cleanHref("//evil.example")).toBe("");
    expect(cleanHref("not a link")).toBe("");
  });
});

describe("parseSections", () => {
  it("keeps known kinds and fields, drops the rest", () => {
    const out = parseSections([
      { id: "a", kind: "hero", on: true, data: { headline: "Hi", bogus: 1, primary: { label: "Go", href: "javascript:x" } } },
      { id: "b", kind: "nope", data: {} },
      "junk",
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].data.headline).toBe("Hi");
    expect(out[0].data).not.toHaveProperty("bogus");
    expect(out[0].data.primary).toEqual({ label: "", href: "" });
    expect(out[0].data.layout).toBe("split");
  });
  it("allows the banner and contact once, and fixes duplicate ids", () => {
    const out = parseSections([
      { id: "x", kind: "hero" },
      { id: "y", kind: "hero" },
      { id: "x", kind: "text", data: { body: "a" } },
    ]);
    expect(out.map((s) => s.kind)).toEqual(["hero", "text"]);
    expect(new Set(out.map((s) => s.id)).size).toBe(2);
  });
  it("clamps numbers, cleans lists and drops empty rows", () => {
    const [s] = parseSections([{ id: "s", kind: "stores", data: { limit: 999, sort: "weird" } }]);
    expect(s.data.limit).toBe(24);
    expect(s.data.sort).toBe("newest");
    const [svc] = parseSections([{ id: "v", kind: "services", data: { items: [{ icon: "shirt", title: "", text: "" }, { icon: "zzz", title: "Print" }] } }]);
    expect(svc.data.items).toEqual([{ icon: "shirt", title: "Print", text: "", link: { label: "", href: "" } }]);
  });
  it("keeps the on/off switch", () => {
    expect(parseSections([{ id: "c", kind: "cta", on: false }])[0].on).toBe(false);
  });
});

describe("site details", () => {
  it("keeps web social links only, and defaults the header button", () => {
    const site = parseSite({ social: { instagram: "instagram.com/jakes", facebook: "/local", made_up: "https://x.y" }, hours: "Mon 9-5" });
    expect(site.social).toEqual({ instagram: "https://instagram.com/jakes" });
    expect(site.hours).toBe("Mon 9-5");
    expect(site.headerButton).toEqual({ label: "Get a quote", href: "/quote" });
    expect(site.storesLink).toBe(true);
    expect(parseSite({ headerButton: { label: "", href: "" } }).headerButton.href).toBe("");
  });
});

describe("helpers", () => {
  it("finds uploaded photos, including in lists", () => {
    const sections = parseSections([
      { id: "h", kind: "hero", data: { image: "cmphoto0000000000001" } },
      { id: "g", kind: "gallery", data: { images: [{ image: "cmphoto0000000000002", caption: "Shirts" }, { image: "../../etc" }] } },
    ]);
    expect(sectionImages(sections)).toEqual(["cmphoto0000000000001", "cmphoto0000000000002"]);
  });
  it("links the first shown section of each kind from the menu", () => {
    const sections = parseSections([
      { id: "a", kind: "about", on: false },
      { id: "b", kind: "about" },
      { id: "c", kind: "contact" },
    ]);
    expect([...sectionAnchors(sections).entries()]).toEqual([["b", "about"], ["c", "contact"]]);
  });
  it("starts new list sections with a row to fill in", () => {
    const s = blankSection("testimonials", "t");
    expect(s.data.items).toHaveLength(1);
    expect(parseSections([s])[0].data.items).toEqual([]);
  });
  it("uses the built-in homepage until the business saves its own", () => {
    const d = defaultSections({ name: "Jake's", city: "Keene" }, null);
    expect(d[0].kind).toBe("hero");
    expect(d.at(-1)!.kind).toBe("contact");
    expect(String(d.find((s) => s.kind === "about")!.data.body)).toContain("in Keene");
    expect(sectionsOf({ homeSections: null, tagline: null }, { name: "J" })).toHaveLength(d.length);
    expect(sectionsOf({ homeSections: [{ id: "t", kind: "text", data: { body: "x" } }], tagline: null }, { name: "J" })).toHaveLength(1);
  });
});

describe("section looks and team-store homepages", () => {
  it("keeps a section's background and color, and drops bad ones", () => {
    const [a, b] = parseSections([
      { id: "a", kind: "services", data: { bg: "dark", color: "#1D4ED8" } },
      { id: "b", kind: "services", data: { bg: "neon", color: "blue" } },
    ]);
    expect([a.data.bg, a.data.color]).toEqual(["dark", "#1d4ed8"]);
    expect([b.data.bg, b.data.color]).toEqual(["auto", ""]);
  });
  it("gives the banner a color but no background choice", () => {
    expect(parseSections([{ kind: "hero", data: { bg: "dark", color: "#ff0000" } }])[0].data).toMatchObject({ color: "#ff0000" });
    expect(parseSections([{ kind: "hero", data: { bg: "dark" } }])[0].data.bg).toBeUndefined();
  });
  it("starts the infographic sections filled in", () => {
    expect((blankSection("timeline").data.items as unknown[]).length).toBe(5);
    const methods = blankSection("methods").data.items as Record<string, unknown>[];
    expect(methods[0]).toMatchObject({ name: "Screen printing", durability: 5, cost: "$" });
    expect(blankSection("stores").data.card).toBe("photo");
  });
  it("keeps store showcases off team-store homepages", () => {
    expect(kindsFor("AFFILIATE")).not.toContain("stores");
    expect(kindsFor("AFFILIATE")).not.toContain("logos");
    expect(kindsFor("ROOT")).toContain("stores");
    expect(parseSections([{ kind: "stores" }, { kind: "shop" }], "AFFILIATE").map((x) => x.kind)).toEqual(["shop"]);
  });
  it("suggests a team-store homepage with the store's name", () => {
    const a = affiliateSections({ name: "Keene Swim", tagline: "Season gear" });
    expect(a[0].data).toMatchObject({ headline: "Keene Swim", text: "Season gear" });
    expect(a.map((x) => x.kind)).toEqual(["hero", "features", "shop", "steps"]);
    expect(sectionsOf({ homeSections: null, tagline: null, kind: "AFFILIATE", name: "Keene Swim" }, { name: "J" })[0].kind).toBe("hero");
  });
});
