# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Full `OverlayController` API — `inject`, `click`, `fill`, `hover`,
  `scroll`, `select`. Every method short-circuits to the plain
  Playwright locator call when neither `PW_LIVE_DEBUG=1` nor
  `PW_TRACE=1` is set (zero evaluate roundtrips in CI).
- Low-level exports — `injectCursorOverlay`, `moveCursorOverlay`.
- `overlayConfig(userConfig)` — drop-in `playwright.config.ts` helper
  that applies overlay-friendly defaults (trace, video, headed in
  live-debug mode) and shallow-merges user overrides.
- Deprecated function-style shims for migration from
  `ai-lite-demo`'s `debugCursor.ts` — `clickWithOverlay`,
  `getOverlayController`.
- Regression suite covering every action method plus the deprecated
  helpers, run against `data:text/html` fixtures (no dev server).
- Runnable `examples/minimal/` demo with a single spec exercising all
  five overlay methods on a tiny self-contained HTML fixture.
- Expanded README with install, quickstart, config-helper, full API
  table, environment flags, and migration notes.
- Repository scaffolding — `package.json`, `tsconfig.json`,
  `tsup.config.ts`, `eslint.config.mjs`, `playwright.config.ts`, CI
  workflow, PR size check (1000-line cap, excluding lockfiles /
  logs / `dist/` / `node_modules/` / `test-results/` /
  `playwright-report/`).
