import { useEffect, useRef, useState } from "react";

/**
 * Animates a number up to its value (ease-out).
 *
 * The animation is decoration; the number is not. `requestAnimationFrame` never
 * fires while the document is hidden, so a purely rAF-driven counter starting at
 * zero shows a confident, wrong "0" to anyone who opens the app in a background
 * tab and comes back to it later. Reduced motion and a hidden document both go
 * straight to the real value, and a backstop timer guarantees the number lands
 * even if no frame is ever served.
 */
/** A NaN reading is a bug upstream, but it must never reach the screen. */
function safe(value: number): number {
  return isFinite(value) ? value : 0;
}

function skipAnimation(value: number): boolean {
  if (!isFinite(value)) return true;
  if (typeof document !== "undefined" && document.hidden) return true;
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function CountUp({
  value,
  decimals = 0,
  duration = 1100,
  delay = 0,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  delay?: number;
}) {
  const [shown, setShown] = useState(() => (skipAnimation(value) ? safe(value) : 0));
  const from = useRef(0);

  useEffect(() => {
    const settle = () => {
      setShown(safe(value));
      from.current = safe(value);
    };
    if (skipAnimation(value)) {
      settle();
      return;
    }

    let raf = 0;
    const start = from.current;
    const t0 = performance.now() + delay;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - t0) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(start + (value - start) * eased);
      if (t < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);

    // If the tab is hidden part-way through, frames stop arriving. Timers are
    // throttled but still fire, so the number always finishes correct.
    const backstop = window.setTimeout(settle, delay + duration + 250);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(backstop);
    };
  }, [value, duration, delay]);

  return <>{shown.toFixed(decimals)}</>;
}
