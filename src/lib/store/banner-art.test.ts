import { describe, expect, it } from "vitest";
import { ARTS, artsFor, bannerArtOf, DEFAULT_ART } from "./banner-art";
import { THEMES } from "./themes";

describe("banner art", () => {
  it("uses the store's pick, else its theme's; 'none' means plain", () => {
    expect(bannerArtOf({ theme: "sports", heroArt: null })).toBe("speed");
    expect(bannerArtOf({ theme: "sports", heroArt: "hills" })).toBe("hills");
    expect(bannerArtOf({ theme: "luxury", heroArt: "none" })).toBeNull();
    // Unknown picks and themes fall back.
    expect(bannerArtOf({ theme: "neon", heroArt: "lasers" })).toBe("shapes");
  });

  it("every theme has two arts, its own listed first", () => {
    for (const theme of Object.keys(THEMES) as (keyof typeof THEMES)[]) {
      const own = (Object.keys(ARTS) as (keyof typeof ARTS)[]).filter((k) => ARTS[k].theme === theme);
      expect(own).toHaveLength(2);
      expect(own).toContain(DEFAULT_ART[theme]);
      expect(artsFor(theme).slice(0, 2)).toEqual(own);
      expect(artsFor(theme)).toHaveLength(Object.keys(ARTS).length);
    }
  });
});
