import { describe, expect, it } from "vitest";
import {
  clearLegacyChecklist,
  legacyChecklistKeys,
  minorDigits,
  nextPosition,
  planLegacyImport,
  readLegacyChecklist,
  toMinor,
  totalsByCurrency,
  type ChecklistEntry,
} from "./checklist";

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  get size() {
    return this.m.size;
  }
}

const seq = () => {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
};

const legacyStorage = (tripId: string) => {
  const s = new MemoryStorage();
  const k = legacyChecklistKeys(tripId);
  s.setItem(
    k.packing,
    JSON.stringify([
      { id: "ab12cd34", text: "Passport", done: true },
      { id: "x", text: "  ", done: false },
      { id: "y", text: "Adapter", done: false },
    ]),
  );
  s.setItem(
    k.expenses,
    JSON.stringify([
      { id: "e1", label: "Tram pass", amount: 6.4 },
      { id: "e2", label: "Refund", amount: -3 },
      { id: "e3", label: "Broken", amount: "abc" },
    ]),
  );
  s.setItem(k.dismissed, JSON.stringify(["Umbrella"]));
  s.setItem("unrelated", "keep me");
  return s;
};

describe("money", () => {
  it("uses the currency's own minor unit", () => {
    expect(minorDigits("EUR")).toBe(2);
    expect(minorDigits("JPY")).toBe(0);
    expect(toMinor(6.4, "EUR")).toBe(640);
    expect(toMinor(1200, "JPY")).toBe(1200);
    expect(toMinor(0.1 + 0.2, "EUR")).toBe(30);
    expect(toMinor(-1, "EUR")).toBeNull();
    expect(toMinor(Number.NaN, "EUR")).toBeNull();
  });

  it("totals expenses per currency and ignores packing", () => {
    const items = [
      { kind: "expense", amountMinor: 500, currency: "EUR" },
      { kind: "expense", amountMinor: 250, currency: "EUR" },
      { kind: "expense", amountMinor: 1000, currency: "GBP" },
      { kind: "packing", amountMinor: 0, currency: "" },
    ] as ChecklistEntry[];
    expect([...totalsByCurrency(items)]).toEqual([
      ["EUR", 750],
      ["GBP", 1000],
    ]);
  });
});

describe("legacy import", () => {
  it("reads nothing when an older build left nothing", () => {
    expect(readLegacyChecklist(new MemoryStorage(), "t1")).toBeNull();
  });

  it("reads packing, expenses and dismissals, dropping junk rows", () => {
    const legacy = readLegacyChecklist(legacyStorage("t1"), "t1")!;
    expect(legacy.packing).toEqual([
      { text: "Passport", done: true },
      { text: "Adapter", done: false },
    ]);
    expect(legacy.expenses.map((e) => e.label)).toEqual(["Tram pass", "Refund", "Broken"]);
    expect(legacy.dismissed).toEqual(["Umbrella"]);
  });

  it("plans UUID-keyed items after what the server has, in minor units", () => {
    const legacy = readLegacyChecklist(legacyStorage("t1"), "t1")!;
    const server: ChecklistEntry[] = [
      {
        id: "s1",
        kind: "packing",
        text: "Charger",
        done: false,
        amountMinor: 0,
        currency: "",
        position: 0,
      },
    ];
    const plan = planLegacyImport(legacy, server, "EUR", [], seq());
    expect(plan.items).toEqual([
      {
        id: "00000000-0000-4000-8000-000000000001",
        kind: "packing",
        text: "Passport",
        done: true,
        amountMinor: 0,
        currency: "",
        position: 1,
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        kind: "packing",
        text: "Adapter",
        done: false,
        amountMinor: 0,
        currency: "",
        position: 2,
      },
      {
        id: "00000000-0000-4000-8000-000000000003",
        kind: "expense",
        text: "Tram pass",
        done: false,
        amountMinor: 640,
        currency: "EUR",
        position: 0,
      },
      {
        id: "00000000-0000-4000-8000-000000000004",
        kind: "expense",
        text: "Refund",
        done: false,
        amountMinor: 300,
        currency: "EUR",
        position: 1,
      },
    ]);
    expect(plan.dismissed).toEqual(["Umbrella"]);
  });

  it("is idempotent: a second run against the imported server list uploads nothing", () => {
    const legacy = readLegacyChecklist(legacyStorage("t1"), "t1")!;
    const first = planLegacyImport(legacy, [], "EUR", [], seq());
    const second = planLegacyImport(legacy, first.items, "EUR", ["umbrella"], seq());
    expect(second.items).toEqual([]);
    expect(second.dismissed).toEqual([]);
  });

  it("clears only this trip's keys", () => {
    const s = legacyStorage("t1");
    clearLegacyChecklist(s, "t1");
    expect(readLegacyChecklist(s, "t1")).toBeNull();
    expect(s.getItem("unrelated")).toBe("keep me");
  });

  it("puts new items at the end of their own kind", () => {
    const items = [
      { kind: "packing", position: 4 },
      { kind: "expense", position: 9 },
    ] as ChecklistEntry[];
    expect(nextPosition(items, "packing")).toBe(5);
    expect(nextPosition([], "expense")).toBe(0);
  });
});
