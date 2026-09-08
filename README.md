# AbdQuest

A personal gamified habit / prayer / fitness tracker. RPG progression (50 levels,
milestones, achievements, loot), prayer tracking with prayer-time lookup, workout
logging, calorie / weight / water / sleep tracking, a daily journal, and an optional
Google Health sync. All data is stored locally in the browser — there is no backend.

## Status: staged modernization in progress

The app is being moved off a single hand-written `AbdQuest.html` onto a modern
Vite + React + TypeScript build, **without breaking the running app and without
losing data**. See [`docs` in the plan file] and the phase list below.

- `legacy/AbdQuest.html` — frozen snapshot of the pre-modernization app (still the
  deployed version until the Phase 3 cutover).
- `src/` — the new app. `src/lib/` holds the pure game logic, extracted verbatim
  from the legacy file and covered by tests.
- The persisted `localStorage` shape (`abdquest_v2`) is unchanged, so existing data
  keeps loading.

### Phases

| Phase | What                                                                                                                 |
| ----- | -------------------------------------------------------------------------------------------------------------------- |
| 0 ✅  | Vite + TS + Vitest toolchain, single-file build, pure logic extracted + characterization tests, ESLint/Prettier, CI  |
| 1     | Fix the correctness bugs: local-time dates, validated import, storage-failure warnings, error boundary, PWA manifest |
| 2     | Replace the OAuth flow with PKCE (no client secret in the browser)                                                   |
| 3     | Extract the monolith into typed components + a `useReducer` store, screen by screen                                  |
| 4     | Real backup, accessibility, offline service worker, design + perf pass                                               |

## Develop

```bash
npm install
npm run dev        # local dev server
npm test           # Vitest
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run build      # -> dist/index.html  (one self-contained file)
```

`npm run build` produces a single `dist/index.html` with everything inlined — deploy
it by copying that one file, or open it directly.

## Privacy

See `privacy.html`. No analytics, no trackers, no third-party data sharing. Google
Health data (if connected) is fetched directly to the device and never sent anywhere
else.
