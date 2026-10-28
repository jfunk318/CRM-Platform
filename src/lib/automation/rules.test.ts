import { describe, expect, it } from "vitest";
import { conditionsFor, describeConditions, matches, parseActions, parseConditions, RECIPES, render, RuleError } from "./rules";

const order = { type: "ORDER" as const, statusId: "s1", storeId: null, rush: false, total: 400 };

describe("rule conditions", () => {
  it("match on status, type, store, rush and total; no conditions match everything", () => {
    expect(matches({}, { order })).toBe(true);
    expect(matches({ statusIds: ["s1", "s2"] }, { order })).toBe(true);
    expect(matches({ statusIds: ["s2"] }, { order })).toBe(false);
    expect(matches({ orderType: "QUOTE" }, { order })).toBe(false);
    expect(matches({ store: "none" }, { order })).toBe(true);
    expect(matches({ store: "none" }, { order: { ...order, storeId: "st" } })).toBe(false);
    expect(matches({ store: "store", storeId: "st" }, { order: { ...order, storeId: "st" } })).toBe(true);
    expect(matches({ store: "store", storeId: "st" }, { order })).toBe(false);
    expect(matches({ rushOnly: true }, { order })).toBe(false);
    expect(matches({ minTotal: 400 }, { order })).toBe(true);
    expect(matches({ minTotal: 400.01 }, { order })).toBe(false);
  });

  it("match a lead's source by part, ignoring case", () => {
    expect(matches({ leadSource: "trade" }, { lead: { source: "Trade show" } })).toBe(true);
    expect(matches({ leadSource: "web" }, { lead: { source: "Trade show" } })).toBe(false);
    expect(matches({ leadSource: "web" }, { lead: { source: null } })).toBe(false);
  });

  it("are tidied from the form and kept to what fits the trigger", () => {
    expect(parseConditions({ statusIds: ["a", 3], orderType: "X", store: "none", rushOnly: "yes", minTotal: "250", leadSource: "  Web " })).toEqual({ statusIds: ["a"], store: "none", minTotal: 250, leadSource: "Web" });
    expect(() => parseConditions({ store: "store" })).toThrow(RuleError);
    expect(() => parseConditions({ minTotal: "-1" })).toThrow(/number/);
    const all = { statusIds: ["a"], orderType: "QUOTE" as const, store: "none" as const, rushOnly: true, leadSource: "Web" };
    expect(conditionsFor("STATUS_CHANGED", all)).toEqual({ statusIds: ["a"], orderType: "QUOTE", store: "none", rushOnly: true });
    expect(conditionsFor("ORDER_PAID", all)).toEqual({ store: "none", rushOnly: true });
    expect(conditionsFor("ONLINE_ORDER", all)).toEqual({ rushOnly: true });
    expect(conditionsFor("LEAD_CREATED", all)).toEqual({ leadSource: "Web" });
    expect(conditionsFor("STORE_REQUEST", all)).toEqual({});
  });

  it("are described for the rule list", () => {
    const names = { statuses: new Map([["a", "Sent"]]), stores: new Map([["st", "Tigers"]]) };
    expect(describeConditions({ statusIds: ["a"], orderType: "QUOTE", store: "store", storeId: "st", minTotal: 1000 }, names)).toBe("to Sent, quotes only, from Tigers, $1,000 or more");
    expect(describeConditions({}, names)).toBe("");
  });
});

describe("rule actions", () => {
  it("are checked and tidied", () => {
    expect(parseActions([{ type: "TASK", title: " Call ", dueInDays: "2", assignTo: "assignee", extra: 1 }])).toEqual([{ type: "TASK", title: "Call", dueInDays: 2, assignTo: "assignee" }]);
    expect(() => parseActions([])).toThrow(/at least one/);
    expect(() => parseActions([{ type: "EMAIL_CUSTOMER", subject: "Hi", body: "" }])).toThrow(/Action 1/);
    expect(() => parseActions([{ type: "NOTE", text: "ok" }, { type: "EMAIL_STAFF", subject: "a", body: "b" }])).toThrow(/Action 2: choose who/);
    expect(() => parseActions([{ type: "TASK", title: "x", dueInDays: 1.5 }])).toThrow(/0 to 365/);
    expect(() => parseActions([{ type: "DELETE_EVERYTHING" }])).toThrow(/choose what/);
  });

  it("fill placeholders, leaving unknown ones blank", () => {
    expect(render("Hi {{customer.firstName}}, {{ order.ref }} is {{order.status}}{{nope}}.", { "customer.firstName": "Pat", "order.ref": "#1042", "order.status": "ready" })).toBe("Hi Pat, #1042 is ready.");
  });

  it("recipes are valid rules", () => {
    for (const r of Object.values(RECIPES)) {
      expect(parseActions(r.actions)).toEqual(r.actions);
      expect(conditionsFor(r.trigger, parseConditions(r.conditions))).toEqual(r.conditions);
    }
  });
});
