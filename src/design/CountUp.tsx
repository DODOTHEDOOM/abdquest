import { useEffect, useRef, useState } from "react";

/** Animates a number up to its value (ease-out). Instant under reduced motion. */
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
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !isFinite(value)) {
      setShown(value);
      from.current = value;
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
    return () => cancelAnimationFrame(raf);
  }, [value, duration, delay]);

  return <>{shown.toFixed(decimals)}</>;
}
