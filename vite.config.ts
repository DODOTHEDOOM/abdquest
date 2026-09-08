import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// AbdQuest ships as ONE self-contained file (index.html with everything inlined),
// so it keeps working when simply opened or hosted as a static file — same
// deployment story as the legacy AbdQuest.html.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
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
});
