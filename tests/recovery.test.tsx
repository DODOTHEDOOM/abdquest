import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Recovery } from "../src/Recovery";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  // React logs caught errors loudly; keep the test output readable.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  localStorage.clear();
});

function Boom(): never {
  throw new Error("bad data in an old record");
}

describe("Recovery", () => {
  it("renders its children when nothing goes wrong", () => {
    act(() =>
      root.render(
        <Recovery>
          <p>all fine</p>
        </Recovery>,
      ),
    );
    expect(host.textContent).toBe("all fine");
  });

  it("replaces a crash with a recovery screen instead of a blank page", () => {
    act(() =>
      root.render(
        <Recovery>
          <Boom />
        </Recovery>,
      ),
    );
    const text = host.textContent ?? "";
    expect(text).toContain("Something went wrong");
    expect(text).toContain("Your data is safe");
    expect(text).toContain("Save a copy of my data");
    expect(text).toContain("Try again");
    // The real error is available for whoever has to fix it.
    expect(text).toContain("bad data in an old record");
  });

  it("offers the classic app as a way back in the personal edition", () => {
    act(() =>
      root.render(
        <Recovery>
          <Boom />
        </Recovery>,
      ),
    );
    const link = host.querySelector("a");
    expect(link?.textContent).toBe("Open the classic app");
    expect(link?.getAttribute("href")).toMatch(/classic\.html$/);
  });

  it("does not touch stored data while recovering", () => {
    localStorage.setItem("abdquest_v2", '{"xp":1}');
    localStorage.setItem("abdquest_v3", '{"version":3}');
    act(() =>
      root.render(
        <Recovery>
          <Boom />
        </Recovery>,
      ),
    );
    expect(localStorage.getItem("abdquest_v2")).toBe('{"xp":1}');
    expect(localStorage.getItem("abdquest_v3")).toBe('{"version":3}');
  });
});
