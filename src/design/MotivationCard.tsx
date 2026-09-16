import type { CSSProperties } from "react";
import type { MotivationCard as Card } from "../lib/motivation";

const TONE_COLOR: Record<Card["tone"], string> = {
  celebrate: "var(--m-habits)",
  push: "var(--m-strain)",
  protect: "var(--danger)",
  ease: "var(--m-sleep)",
  steady: "var(--m-fitness)",
};

/**
 * The line that should make you do the thing. Tinted by tone so a record you
 * broke and a streak about to die never look the same.
 */
export function MotivationBanner({ card, onClick }: { card: Card; onClick?: () => void }) {
  const color = TONE_COLOR[card.tone];
  const body = (
    <>
      <span className="motiv__icon" aria-hidden="true">
        {card.icon}
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="motiv__headline">{card.headline}</span>
        <span className="motiv__detail">{card.detail}</span>
      </span>
    </>
  );
  const style = { "--pc": color } as CSSProperties;

  if (onClick) {
    return (
      <button type="button" className="motiv" style={style} onClick={onClick}>
        {body}
      </button>
    );
  }
  return (
    <div className="motiv" style={style}>
      {body}
    </div>
  );
}
