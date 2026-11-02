import { describe, expect, it } from "vitest";
import { availableTo, parseLayout, visibleTo } from "./widgets";

describe("dashboard layouts", () => {
  it("keep known widgets once each, with a valid size", () => {
    expect(parseLayout([{ key: "my-tasks", size: "third" }, { key: "nope" }, { key: "my-tasks", size: "full" }, { key: "create-quote", size: "huge" }])).toEqual([
      { key: "my-tasks", size: "third" },
      { key: "create-quote", size: "half" },
    ]);
    expect(parseLayout("junk")).toEqual([]);
  });

  it("show each person only the widgets their roles allow", () => {
    const layout = parseLayout([{ key: "create-quote" }, { key: "floor-stats" }, { key: "my-tasks" }]);
    expect(visibleTo(layout, ["PRODUCTION"]).map((i) => i.key)).toEqual(["floor-stats", "my-tasks"]);
    expect(visibleTo(layout, ["ADMIN"])).toHaveLength(3);
    expect(availableTo(["SALES"])).toContain("create-quote");
    expect(availableTo(["SALES"])).not.toContain("sales-snapshot");
  });
});
