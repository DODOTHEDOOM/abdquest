import "./ambient.css";

/** Full-screen living background. Sits behind everything; colours come from the theme. */
export function Ambient() {
  return (
    <div className="ambient" aria-hidden="true">
      <div className="ambient__blob ambient__blob--1" />
      <div className="ambient__blob ambient__blob--2" />
      <div className="ambient__blob ambient__blob--3" />
      <div className="ambient__grain" />
    </div>
  );
}
