import { describe, it, expect, beforeEach } from "vitest";
import { MAIN_KEY, vState, savMain, savBak, loadSafe } from "../src/lib/storage";

const valid = { xp: 10, streak: 2, done: {}, habits: [], prayers: [] };

beforeEach(() => localStorage.clear());

describe("vState", () => {
  it("accepts a blob with all required keys", () => {
    expect(vState(valid)).toBe(true);
  });
  it("rejects non-objects and blobs missing a required key", () => {
    expect(vState(null)).toBe(false);
    expect(vState("nope")).toBe(false);
    expect(vState({ xp: 1, streak: 1, done: {}, habits: [] })).toBe(false); // no prayers
  });
});

describe("save / load round-trip", () => {
  it("savMain then loadSafe returns the same data", () => {
    savMain({ ...valid, xp: 999 });
    expect(loadSafe()).toMatchObject({ xp: 999 });
  });

  it("loadSafe falls back to the backup slot when main is missing/corrupt", () => {
    localStorage.setItem(MAIN_KEY, "{not json");
    savBak({ ...valid, xp: 77 });
    expect(loadSafe()).toMatchObject({ xp: 77 });
  });

  it("loadSafe returns null when neither slot holds a valid blob", () => {
    localStorage.setItem(MAIN_KEY, JSON.stringify({ foo: 1 }));
    expect(loadSafe()).toBeNull();
  });

  it("savMain swallows quota errors (legacy behaviour, pinned)", () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
    try {
      expect(() => savMain(valid)).not.toThrow();
    } finally {
      Storage.prototype.setItem = orig;
    }
  });
});
