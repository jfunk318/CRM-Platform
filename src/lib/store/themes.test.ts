import { describe, expect, it } from "vitest";
import { bandStyle, contrastText, THEMES, themeFontsUrl, themeOf, themeStyle } from "./themes";

describe("store themes", () => {
  it("falls back to minimal for unknown themes", () => {
    expect(themeOf("sports")).toBe("sports");
    expect(themeOf("neon")).toBe("minimal");
    expect(themeOf(null)).toBe("minimal");
  });
  it("uses the store's accent color if it has a valid one, else the theme's", () => {
    expect(themeStyle("sports", "#0b5394")).toMatchObject({ "--accent": "#0b5394", "--accent-contrast": "#ffffff", "--st-heading-transform": "uppercase" });
    expect(themeStyle("dark", "red")["--accent"]).toBe(THEMES.dark.accent);
    expect(themeStyle("luxury", null)["--st-font-heading"]).toContain("Cormorant Garamond");
  });
  it("picks readable text for buttons on the accent color", () => {
    expect(contrastText("#22d3ee")).toBe("#111111");
    expect(contrastText("#111827")).toBe("#ffffff");
    expect(contrastText("#ffd400")).toBe("#111111");
  });
  it("gives every theme the same set of colors, and loads its fonts", () => {
    const keys = Object.keys(THEMES.minimal.vars).sort();
    for (const t of Object.values(THEMES)) expect(Object.keys(t.vars).sort()).toEqual(keys);
    expect(themeFontsUrl("rustic")).toBe("https://fonts.googleapis.com/css2?family=Bitter:wght@500;600;700&family=Lora:wght@400;500;600&display=swap");
  });

  it("uses a store's own font for headings and text, with its stylesheet", () => {
    const v = themeStyle("luxury", null, "encode");
    expect(v["--st-font-heading"]).toContain("Encode Sans Semi Condensed");
    expect(v["--st-font-body"]).toBe(v["--st-font-heading"]);
    expect(themeFontsUrl("luxury", "encode")).toContain("family=Encode+Sans+Semi+Condensed");
    expect(themeStyle("luxury", null, "comic-sans")["--st-font-heading"]).toContain("Cormorant Garamond");
  });
});

describe("section bands", () => {
  it("draws a solid band in its color, with buttons in the text color", () => {
    const b = bandStyle("accent", "#1d4ed8", "#111111");
    expect(b.background).toBe("#1d4ed8");
    expect(b["--accent"]).toBe("#ffffff");
    expect(b["--accent-contrast"]).toBe("#1d4ed8");
  });
  it("lightens a dark accent on a dark band", () => {
    expect(bandStyle("dark", null, "#111827")["--accent"]).toContain("color-mix");
    expect(bandStyle("dark", null, "#f59e0b")["--accent"]).toBe("#f59e0b");
  });
  it("only sets a color on automatic bands", () => {
    expect(bandStyle("auto", null, "#111111")).toEqual({});
    expect(bandStyle("auto", "#ff0000", "#111111")).toEqual({ "--accent": "#ff0000", "--accent-contrast": "#ffffff" });
  });
});
