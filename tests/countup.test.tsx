import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CountUp } from "../src/design/CountUp";

// React 18 wants to know it is being driven by a test.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

function render(node: ReactElement): string {
  act(() => root.render(node));
  return host.textContent ?? "";
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** jsdom has no matchMedia; the component treats that as "motion is fine". */
function setReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", () => ({ matches: reduce }) as MediaQueryList);
}

describe("CountUp", () => {
  it("shows the real number straight away when the document is hidden", () => {
    // requestAnimationFrame never fires in a hidden document. A counter that
    // waits for a frame would render a confident, wrong "0".
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    expect(render(<CountUp value={52} />)).toBe("52");
  });

  it("shows the real number straight away under reduced motion", () => {
    setReducedMotion(true);
    expect(render(<CountUp value={87} />)).toBe("87");
  });

  it("settles on the real number even if no frame is ever served", () => {
    vi.useFakeTimers();
    setReducedMotion(false);
    // Simulate a tab that is throttled the moment it starts animating.
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 0),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    expect(render(<CountUp value={64} />)).toBe("0");
    act(() => void vi.advanceTimersByTime(2000));
    expect(host.textContent).toBe("64");
  });

  it("renders the requested precision", () => {
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    expect(render(<CountUp value={14.72} decimals={1} />)).toBe("14.7");
  });

  it("never puts NaN in front of the user", () => {
    expect(render(<CountUp value={Number.NaN} />)).toBe("0");
  });
});
