/**
 * Colourways.
 *
 * Each theme is a complete palette applied as CSS custom properties on <html>,
 * so every component re-skins instantly. Like the original app, the bolder
 * palettes unlock as you level up — customisation is part of the reward loop.
 *
 * Metric colours keep the same *meaning* in every theme (recovery = teal,
 * effort = orange, sleep = violet, fitness = blue, habits = green) and are only
 * re-tuned for contrast, so a chart reads the same whichever skin is on.
 * Each metric has a pair of stops (-1 base, -2 bright) used for the 3D arcs.
 */

export interface Theme {
  id: string;
  name: string;
  blurb: string;
  unlockLevel: number;
  dark: boolean;
  vars: Record<string, string>;
}

type Metric = [string, string];
interface PaletteInput {
  bg: string;
  blobs: [string, string, string];
  text: string;
  dim: string;
  faint: string;
  accent: string;
  accentOn: string;
  recovery: Metric;
  strain: Metric;
  sleep: Metric;
  fitness: Metric;
  habits: Metric;
  warn: string;
  danger: string;
}

function metricVars(p: PaletteInput, dark: boolean): Record<string, string> {
  const weak = (c: string) => `color-mix(in srgb, ${c} ${dark ? 22 : 14}%, transparent)`;
  const out: Record<string, string> = {};
  const set = (name: string, m: Metric) => {
    out[`--m-${name}`] = m[0];
    out[`--m-${name}-2`] = m[1];
    out[`--m-${name}-weak`] = weak(m[0]);
  };
  set("recovery", p.recovery);
  set("strain", p.strain);
  set("sleep", p.sleep);
  set("fitness", p.fitness);
  set("habits", p.habits);
  return out;
}

function light(p: PaletteInput): Record<string, string> {
  return {
    "--bg": p.bg,
    "--blob-1": p.blobs[0],
    "--blob-2": p.blobs[1],
    "--blob-3": p.blobs[2],
    "--blob-opacity": "0.85",
    "--surface": "rgba(255,255,255,0.72)",
    "--surface-2": "rgba(24,22,40,0.05)",
    "--surface-raised":
      "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.64) 100%)",
    "--border": "rgba(24,22,40,0.08)",
    "--border-strong": "rgba(24,22,40,0.16)",
    "--text": p.text,
    "--text-dim": p.dim,
    "--text-faint": p.faint,
    "--accent": p.accent,
    "--accent-on": p.accentOn,
    "--accent-weak": `color-mix(in srgb, ${p.accent} 9%, transparent)`,
    "--accent-text": p.accent,
    "--warn": p.warn,
    "--warn-weak": `color-mix(in srgb, ${p.warn} 14%, transparent)`,
    "--danger": p.danger,
    "--danger-weak": `color-mix(in srgb, ${p.danger} 14%, transparent)`,
    "--elev-1": "0 1px 2px rgba(24,22,40,0.06)",
    "--elev-2":
      "0 2px 4px rgba(24,22,40,0.05), 0 12px 26px -12px rgba(24,22,40,0.2), inset 0 1px 0 rgba(255,255,255,0.85)",
    "--elev-3":
      "0 6px 12px rgba(24,22,40,0.07), 0 26px 50px -18px rgba(24,22,40,0.3), inset 0 1px 0 rgba(255,255,255,0.9)",
    "--elev-press": "inset 0 1px 3px rgba(24,22,40,0.12)",
    "--dock": "rgba(255,255,255,0.7)",
    "--groove": "rgba(24,22,40,0.08)",
    "--glow-strength": "0.4",
    "--face-hi": "rgba(255,255,255,0.98)",
    "--face-lo": "rgba(236,234,240,0.92)",
    ...metricVars(p, false),
  };
}

function dark(p: PaletteInput): Record<string, string> {
  return {
    "--bg": p.bg,
    "--blob-1": p.blobs[0],
    "--blob-2": p.blobs[1],
    "--blob-3": p.blobs[2],
    "--blob-opacity": "0.75",
    "--surface": "rgba(255,255,255,0.055)",
    "--surface-2": "rgba(255,255,255,0.06)",
    "--surface-raised":
      "linear-gradient(180deg, rgba(255,255,255,0.085) 0%, rgba(255,255,255,0.035) 100%)",
    "--border": "rgba(255,255,255,0.09)",
    "--border-strong": "rgba(255,255,255,0.17)",
    "--text": p.text,
    "--text-dim": p.dim,
    "--text-faint": p.faint,
    "--accent": p.accent,
    "--accent-on": p.accentOn,
    "--accent-weak": `color-mix(in srgb, ${p.accent} 16%, transparent)`,
    "--accent-text": p.accent,
    "--warn": p.warn,
    "--warn-weak": `color-mix(in srgb, ${p.warn} 20%, transparent)`,
    "--danger": p.danger,
    "--danger-weak": `color-mix(in srgb, ${p.danger} 20%, transparent)`,
    "--elev-1": "0 1px 2px rgba(0,0,0,0.5)",
    "--elev-2":
      "0 2px 6px rgba(0,0,0,0.4), 0 14px 30px -14px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.07)",
    "--elev-3":
      "0 8px 18px rgba(0,0,0,0.45), 0 30px 60px -20px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.09)",
    "--elev-press": "inset 0 1px 4px rgba(0,0,0,0.6)",
    "--dock": "rgba(16,16,26,0.66)",
    "--groove": "rgba(255,255,255,0.075)",
    "--glow-strength": "0.75",
    "--face-hi": "rgba(255,255,255,0.1)",
    "--face-lo": "rgba(255,255,255,0.02)",
    ...metricVars(p, true),
  };
}

export const THEMES: Theme[] = [
  {
    id: "daylight",
    name: "Daylight",
    blurb: "Warm paper with a peach and lavender haze",
    unlockLevel: 1,
    dark: false,
    vars: light({
      bg: "#f6f3ee",
      blobs: ["#ffd3bd", "#d6d0ff", "#c4efdf"],
      text: "#17161c",
      dim: "#5f5d6b",
      faint: "#9896a4",
      accent: "#17161c",
      accentOn: "#ffffff",
      recovery: ["#0e9f8a", "#43dcbb"],
      strain: ["#e8692c", "#ffb04d"],
      sleep: ["#5b54e8", "#a396ff"],
      fitness: ["#2f6fd6", "#62b6ff"],
      habits: ["#20a05e", "#74de90"],
      warn: "#b8741a",
      danger: "#d23c2e",
    }),
  },
  {
    id: "midnight",
    name: "Midnight",
    blurb: "Deep ink with a violet and teal aurora",
    unlockLevel: 1,
    dark: true,
    vars: dark({
      bg: "#07080f",
      blobs: ["#3d2b95", "#0e5f78", "#72205f"],
      text: "#eef0fb",
      dim: "#a3a7c2",
      faint: "#6b6f8a",
      accent: "#eef0fb",
      accentOn: "#07080f",
      recovery: ["#15c6a6", "#78f7da"],
      strain: ["#ff763a", "#ffc670"],
      sleep: ["#7a69ff", "#c7bdff"],
      fitness: ["#3a88ff", "#94d3ff"],
      habits: ["#2dd078", "#a0f6b9"],
      warn: "#f0a63f",
      danger: "#ff6b5c",
    }),
  },
  {
    id: "graphite",
    name: "Graphite",
    blurb: "Pure charcoal so the data does the talking",
    unlockLevel: 1,
    dark: true,
    vars: dark({
      bg: "#0c0c0e",
      blobs: ["#2c2c33", "#1d1d23", "#35353c"],
      text: "#f2f2f4",
      dim: "#a1a1aa",
      faint: "#66666e",
      accent: "#f2f2f4",
      accentOn: "#0c0c0e",
      recovery: ["#10c9a4", "#7bf4d5"],
      strain: ["#ff7137", "#ffbf66"],
      sleep: ["#7d6cff", "#c9c0ff"],
      fitness: ["#3b8cff", "#96d4ff"],
      habits: ["#2ecf78", "#a3f5bb"],
      warn: "#f0a63f",
      danger: "#ff6b5c",
    }),
  },
  {
    id: "lagoon",
    name: "Lagoon",
    blurb: "Sea-glass blues and shallow-water greens",
    unlockLevel: 3,
    dark: false,
    vars: light({
      bg: "#edf5f7",
      blobs: ["#a3e1ef", "#bccfff", "#bff3dc"],
      text: "#0f2430",
      dim: "#4c6673",
      faint: "#88a0ab",
      accent: "#0f2430",
      accentOn: "#ffffff",
      recovery: ["#0a9eaf", "#4fe2ea"],
      strain: ["#e6702c", "#ffb24d"],
      sleep: ["#4d5de6", "#909dff"],
      fitness: ["#1e75c8", "#6ec1ff"],
      habits: ["#1d9d6b", "#70e1a7"],
      warn: "#b57219",
      danger: "#cf3b2e",
    }),
  },
  {
    id: "sakura",
    name: "Sakura",
    blurb: "Blossom pink with apricot and lilac light",
    unlockLevel: 5,
    dark: false,
    vars: light({
      bg: "#fbf0f2",
      blobs: ["#ffc2d2", "#ffdcc2", "#e4cdff"],
      text: "#2a1720",
      dim: "#6e5763",
      faint: "#a8929c",
      accent: "#a82a59",
      accentOn: "#ffffff",
      recovery: ["#179b8b", "#62d8c6"],
      strain: ["#e8633a", "#ffa66d"],
      sleep: ["#8858ee", "#c7a8ff"],
      fitness: ["#3a76d4", "#7cb9ff"],
      habits: ["#2b9c60", "#81dc9e"],
      warn: "#b3701c",
      danger: "#cc3a3a",
    }),
  },
  {
    id: "aurora",
    name: "Aurora",
    blurb: "Northern lights over a black arctic sky",
    unlockLevel: 8,
    dark: true,
    vars: dark({
      bg: "#030f0d",
      blobs: ["#0f7d5d", "#3b1c80", "#0a5070"],
      text: "#e8fbf5",
      dim: "#9ec7bb",
      faint: "#5f8a7e",
      accent: "#8affd9",
      accentOn: "#03110e",
      recovery: ["#1ee0b0", "#8dffdb"],
      strain: ["#ffae38", "#ffe27d"],
      sleep: ["#9b78ff", "#d5c4ff"],
      fitness: ["#30b4ff", "#a1e7ff"],
      habits: ["#48df78", "#b8ffc8"],
      warn: "#ffc24d",
      danger: "#ff6f66",
    }),
  },
  {
    id: "ember",
    name: "Ember",
    blurb: "Glowing coals, molten orange and crimson",
    unlockLevel: 12,
    dark: true,
    vars: dark({
      bg: "#110705",
      blobs: ["#8c2a0e", "#6e0f32", "#8a5a0f"],
      text: "#fff1ea",
      dim: "#d1a898",
      faint: "#8c6557",
      accent: "#ffb13d",
      accentOn: "#130805",
      recovery: ["#1ec29f", "#80f1d1"],
      strain: ["#ff571c", "#ffb33f"],
      sleep: ["#ad69ff", "#e2baff"],
      fitness: ["#4b99ff", "#9dd0ff"],
      habits: ["#4dd579", "#b2f6c1"],
      warn: "#ffc24d",
      danger: "#ff5d4f",
    }),
  },
  {
    id: "aurum",
    name: "Aurum",
    blurb: "Black and gold — a nod to the original Quest",
    unlockLevel: 20,
    dark: true,
    vars: dark({
      bg: "#0a0804",
      blobs: ["#6e4f0b", "#3f2b05", "#5e3b0b"],
      text: "#f7ecd2",
      dim: "#c7b58a",
      faint: "#857650",
      accent: "#ffd479",
      accentOn: "#0a0804",
      recovery: ["#2ac8a3", "#90f1d4"],
      strain: ["#ff872a", "#ffc45e"],
      sleep: ["#8d79ff", "#ccc0ff"],
      fitness: ["#f5c24a", "#fff0c2"],
      habits: ["#56d17b", "#b5f3c3"],
      warn: "#ffc24d",
      danger: "#ff6b5c",
    }),
  },
];

export const DEFAULT_THEME = THEMES[0];

export function themeById(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? DEFAULT_THEME;
}

/** Push a theme's palette onto <html>. Inline custom properties win over the stylesheet. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(k, v);
  root.dataset.theme = theme.dark ? "dark" : "light";
  root.dataset.palette = theme.id;
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute("content", theme.vars["--bg"]));
}
