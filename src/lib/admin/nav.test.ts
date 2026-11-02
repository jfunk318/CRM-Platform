import { describe, expect, it } from "vitest";
import { activeHref, areaFor, NAV } from "./nav";

const at = (url: string) => {
  const u = new URL(url, "http://x");
  const href = activeHref(NAV, u.pathname, u.searchParams);
  return { href, area: areaFor(NAV, href, u.pathname) };
};

describe("the back office menu's sections", () => {
  it("puts each page in its section", () => {
    expect(at("/admin")).toEqual({ href: "/admin", area: "sales" });
    expect(at("/admin/orders?type=QUOTE").area).toBe("sales");
    expect(at("/admin/production/calendar")).toEqual({ href: "/admin/production/calendar", area: "production" });
    expect(at("/admin/inventory").area).toBe("production");
    expect(at("/admin/stores/abc/items")).toEqual({ href: "/admin/stores", area: "web" });
    expect(at("/admin/stores/settings")).toEqual({ href: "/admin/stores/settings", area: "admin" });
    expect(at("/admin/staff/123").area).toBe("admin");
    expect(at("/admin/products/xyz").area).toBe("admin");
    expect(at("/admin/reports/stores?days=30")).toEqual({ href: "/admin/reports/stores", area: "reporting" });
    // Pages outside the menu fall back to Sales.
    expect(at("/admin/account").area).toBe("sales");
  });
});
