// Dashboards per section: your own, shared templates, the section default, and admin-locked ones.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { makeTestBusiness } from "@/test/fixtures";
import { assignDashboard, chooseDashboard, dashboardFor, deleteTemplate, layoutChoices, saveMyDashboard, saveTemplate, setBusinessDefault } from "./layouts";
import { DEFAULT_LAYOUTS } from "./widgets";

let t: Awaited<ReturnType<typeof makeTestBusiness>>;
beforeAll(async () => {
  t = await makeTestBusiness(`dash-${Date.now()}`);
});
afterAll(async () => {
  await t.cleanup();
  await prisma.$disconnect();
});

describe("dashboards", () => {
  it("start with each section's standard, then follow your own, the section default, or a locked one", async () => {
    const me = t.staff.id;
    expect((await dashboardFor(t.db, me, "sales")).layout).toEqual(DEFAULT_LAYOUTS.sales);
    expect((await dashboardFor(t.db, me, "production")).layout).toEqual(DEFAULT_LAYOUTS.production);

    await saveMyDashboard(t.db, me, "sales", [{ key: "my-tasks", size: "full" }]);
    expect(await dashboardFor(t.db, me, "sales")).toMatchObject({ layout: [{ key: "my-tasks", size: "full" }], source: { personal: true } });
    // Other sections are unaffected.
    expect((await dashboardFor(t.db, me, "web")).layout).toEqual(DEFAULT_LAYOUTS.web);

    const desk = await saveTemplate(t.db, "sales", "Sales desk", [{ key: "create-quote", size: "half" }, { key: "recent-quotes", size: "half" }]);
    await setBusinessDefault(t.db, "sales", desk);
    await chooseDashboard(t.db, me, "sales", null);
    expect(await dashboardFor(t.db, me, "sales")).toMatchObject({ layout: [{ key: "create-quote" }, { key: "recent-quotes" }], source: { name: "Sales desk", businessDefault: true } });
    // A Sales template isn't offered (or usable) on the Production dashboard.
    expect((await layoutChoices(t.db, me, "production")).map((c) => c.id)).not.toContain(desk);
    await expect(chooseDashboard(t.db, me, "production", desk)).rejects.toThrow(/isn't available/);

    // An admin locks someone's Production dashboard; they can't switch away there, but Sales is still theirs.
    const floor = await saveTemplate(t.db, "production", "Floor", [{ key: "floor-stats", size: "full" }]);
    await assignDashboard(t.db, me, "production", floor, true);
    expect((await dashboardFor(t.db, me, "production")).source).toMatchObject({ name: "Floor", locked: true });
    await expect(chooseDashboard(t.db, me, "production", null)).rejects.toThrow(/admin has set/);
    await expect(saveMyDashboard(t.db, me, "production", [{ key: "my-tasks", size: "full" }])).rejects.toThrow(/admin has set/);
    await chooseDashboard(t.db, me, "sales", null);

    // Deleting the template frees them, back to the section's standard.
    await deleteTemplate(t.db, floor);
    expect((await dashboardFor(t.db, me, "production")).source).toMatchObject({ name: "Standard", locked: false });
    await expect(saveTemplate(t.db, "web", "Empty", [])).rejects.toThrow(/at least one/);
  });
});
