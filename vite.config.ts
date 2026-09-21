import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// AbdQuest ships as ONE self-contained file (index.html with everything inlined),
// so it keeps working when simply opened or hosted as a static file — same
// deployment story as the legacy AbdQuest.html.
/**
 * The document title and description are baked in per edition.
 *
 * main.tsx also sets document.title at runtime, but that is too late for a link
 * preview or the tab while the page is still loading, so a shared link to the
 * public build would have carried the personal build's name.
 */
function editionHtml(mode: string) {
  const isPublic = mode === "public";
  const name = isPublic ? "Steady" : "Abd's Quest";
  const description = isPublic
    ? "A habit and health tracker that keeps everything on your device and never shows you a number it cannot justify."
    : "Habits, training and health, all on your phone.";
  // The repo's manifest.json belongs to the OLD app: it points start_url at
  // AbdQuest.html and its name is mojibake. Installing the rebuilt app with it
  // would have launched the old one. Each edition gets its own instead.
  const manifest = {
    name,
    short_name: name,
    description,
    start_url: "./",
    scope: "./",
    display: "standalone",
    background_color: isPublic ? "#0e1116" : "#121311",
    theme_color: isPublic ? "#0e1116" : "#121311",
    orientation: "portrait",
    icons: [],
  };

  return {
    name: "edition-html",
    generateBundle(this: { emitFile: (f: Record<string, unknown>) => void }) {
      this.emitFile({
        type: "asset",
        fileName: "manifest.webmanifest",
        source: JSON.stringify(manifest, null, 2),
      });
    },
    transformIndexHtml(html: string) {
      return html
        .replace(/<title>[^<]*<\/title>/, `<title>${name}</title>`)
        .replace(/content="Abd's Quest"/g, `content="${name}"`)
        .replace(
          /<link rel="manifest"[^>]*>/,
          '<link rel="manifest" href="./manifest.webmanifest" />',
        )
        .replace(
          "</head>",
          `  <meta name="description" content="${description}" />
  </head>`,
        );
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), viteSingleFile(), editionHtml(mode)],
  build: {
    // The public edition builds alongside the personal one rather than over it,
    // so both can be previewed from the same checkout.
    outDir: mode === "public" ? "dist-public" : "dist",
    target: "es2020",
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    // Pin a UTC+ timezone so the legacy UTC-vs-local date bug is reproducible in CI.
    env: { TZ: "Europe/London" },
  },
}));
