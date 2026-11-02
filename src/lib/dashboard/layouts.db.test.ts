// Dashboards: your own, shared templates, the business default, and admin-locked ones.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { makeTestBusiness } from "@/test/fixtures";
import { assignDashboard, chooseDashboard, dashboardFor, deleteTemplate, saveMyDashboard, saveTemplate, setBusinessDefault } from "./layouts";
import { DEFAULT_LAYOUT } from "./widgets";

let t: Awaited<ReturnType<typeof makeTestBusiness>>;
beforeAll(async () => {
  t = await makeTestBusiness(`dash-${Date.now()}`);
});
afterAll(async () => {
  await t.cleanup();
  await prisma.$disconnect();
});

describe("dashboards", () => {
  it("start standard, then follow your own, the business default, or a locked one", async () => {
    const me = t.staff.id;
    expect((await dashboardFor(t.db, me)).layout).toEqual(DEFAULT_LAYOUT);

    await saveMyDashboard(t.db, me, [{ key: "my-tasks", size: "full" }]);
    expect(await dashboardFor(t.db, me)).toMatchObject({ layout: [{ key: "my-tasks", size: "full" }], source: { personal: true } });

    const sales = await saveTemplate(t.db, "Sales desk", [{ key: "create-quote", size: "half" }, { key: "recent-quotes", size: "half" }]);
    await setBusinessDefault(t.db, sales);
    // Back to the default: the template.
    await chooseDashboard(t.db, me, null);
    expect(await dashboardFor(t.db, me)).toMatchObject({ layout: [{ key: "create-quote" }, { key: "recent-quotes" }], source: { name: "Sales desk", businessDefault: true } });

    // An admin locks someone to a template; they can't switch away.
    const floor = await saveTemplate(t.db, "Floor", [{ key: "floor-stats", size: "full" }]);
    await assignDashboard(t.db, me, floor, true);
    expect((await dashboardFor(t.db, me)).source).toMatchObject({ name: "Floor", locked: true });
    await expect(chooseDashboard(t.db, me, null)).rejects.toThrow(/admin has set/);
    await expect(saveMyDashboard(t.db, me, [{ key: "my-tasks", size: "full" }])).rejects.toThrow(/admin has set/);

    // Deleting the template frees them, back to the default.
    await deleteTemplate(t.db, floor);
    expect((await dashboardFor(t.db, me)).source).toMatchObject({ name: "Sales desk", locked: false });
    await expect(saveTemplate(t.db, "Empty", [])).rejects.toThrow(/at least one/);
  });
});
