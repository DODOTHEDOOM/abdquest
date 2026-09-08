import { describe, it, expect } from "vitest";
import { toHijri } from "../src/lib/hijri";

describe("toHijri", () => {
  it("produces '<day> <month> <year> AH' with a valid month name", () => {
    const out = toHijri(new Date(2025, 6, 15));
    expect(out).toMatch(/^\d{1,2} [A-Za-z' ]+ \d{3,4} AH$/);
  });

  // Characterization: pins whatever the legacy tabular algorithm currently outputs.
  // If these change, it must be a conscious decision (e.g. switching to Intl).
  it("matches the legacy algorithm output for reference dates", () => {
    expect(toHijri(new Date(2025, 0, 1))).toBe("1 Rajab 1446 AH");
    expect(toHijri(new Date(2026, 8, 8))).toBe("25 Rabi' I 1448 AH");
  });
});
