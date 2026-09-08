import { describe, it, expect } from "vitest";
import { LEVELS, getLvl, getNextLvl } from "../src/lib/levels";

describe("levels", () => {
  it("has 50 contiguous, strictly increasing levels starting at 0 XP", () => {
    expect(LEVELS).toHaveLength(50);
    expect(LEVELS[0]).toMatchObject({ level: 1, minXp: 0 });
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].level).toBe(i + 1);
      expect(LEVELS[i].minXp).toBeGreaterThan(LEVELS[i - 1].minXp);
    }
  });

  it("getLvl picks the highest level whose minXp is reached", () => {
    expect(getLvl(0).level).toBe(1);
    expect(getLvl(-100).level).toBe(1); // clamps below zero
    expect(getLvl(149).level).toBe(1);
    expect(getLvl(150).level).toBe(2);
    expect(getLvl(1234).name).toBe("Knight"); // L5 @ 1000
    expect(getLvl(999_999_999).level).toBe(50);
  });

  it("getNextLvl returns the following level, or the same level at the cap", () => {
    expect(getNextLvl(0).level).toBe(2);
    expect(getNextLvl(1234).level).toBe(6);
    expect(getNextLvl(935_000).level).toBe(50);
    expect(getNextLvl(999_999_999).level).toBe(50);
  });
});
