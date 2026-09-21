import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // sw.js is a legacy self-unregistering stub; Phase 4 replaces it with a real
  // service worker (and its own worker-scoped lint config).
  { ignores: ["dist/**", "dist-public/**", "legacy/**", "node_modules/**", "coverage/**", "sw.js", "site/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        navigator: "readonly",
        location: "readonly",
        fetch: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Storage: "readonly",
        DOMException: "readonly",
      },
    },
    rules: {
      // Legacy code leans on `any` heavily; loosen while the port is in progress.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["tests/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { localStorage: "readonly", Storage: "readonly", DOMException: "readonly" },
    },
  },
  // A verbatim port of the working Google Health module. It is deliberately not
  // modernised — see the header in that file — so the rules it predates are off
  // for it alone rather than for the whole codebase.
  {
    files: ["src/health/legacyGoogleHealth.ts"],
    rules: {
      "no-prototype-builtins": "off",
      "no-var": "off",
      "prefer-const": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
    },
  },
  // The rebuilt app's service worker runs in a worker scope, not a window.
  {
    files: ["public/sw.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        self: "readonly",
        caches: "readonly",
        fetch: "readonly",
        URL: "readonly",
        Response: "readonly",
        Request: "readonly",
      },
    },
  },
);
