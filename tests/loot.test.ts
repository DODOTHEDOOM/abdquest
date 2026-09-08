import { describe, it, expect, vi, afterEach } from "vitest";
import { ITEMS, DAILY_CH, getDailyCh, randItem } from "../src/lib/loot";

afterEach(() => vi.restoreAllMocks());

describe("ITEMS table", () => {
  it("has unique ids and covers all four rarities", () => {
    const ids = ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of ["common", "rare", "epic", "legendary"] as const) {
      expect(ITEMS.some((i) => i.rarity === r)).toBe(true);
    }
  });
});

describe("getDailyCh", () => {
  it("is deterministic for a given key", () => {
    expect(getDailyCh("2025-07-15")).toBe(getDailyCh("2025-07-15"));
  });
  it("matches legacy hash output for reference keys", () => {
    expect(getDailyCh("2025-07-15").label).toBe("Sleep before midnight");
    expect(getDailyCh("2025-07-16").label).toBe("Log your weight today");
    expect(getDailyCh("abd").label).toBe("15 minutes of cardio");
  });
  it("always returns a member of DAILY_CH", () => {
    for (let i = 0; i < 50; i++) {
      expect(DAILY_CH).toContain(getDailyCh("k" + i));
    }
  });
});

describe("randItem", () => {
  it("picks tier by Math.random threshold (luck = 1)", () => {
    const roll = (v: number) => {
      vi.spyOn(Math, "random").mockReturnValue(v);
      return randItem(1).rarity;
    };
    expect(roll(0.01)).toBe("legendary"); // < 0.05
    expect(roll(0.1)).toBe("epic"); // < 0.15
    expect(roll(0.3)).toBe("rare"); // < 0.40
    expect(roll(0.9)).toBe("common"); // else
  });

  it("luck multiplier widens the better tiers", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.09);
    expect(randItem(1).rarity).toBe("epic"); // 0.09 < 0.15
    expect(randItem(2).rarity).toBe("legendary"); // 0.09 < 0.05*2 = 0.10
  });
});
