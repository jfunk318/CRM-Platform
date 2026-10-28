import { describe, expect, it } from "vitest";
import { contrastText, THEMES, themeFontsUrl, themeOf, themeStyle } from "./themes";

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
});
