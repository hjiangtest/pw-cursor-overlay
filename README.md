# pw-cursor-overlay

> Visible cursor / trail / ripple overlay for Playwright — **zero-cost in CI**,
> **agent-friendly in local debug**.

A lightweight overlay layer for Playwright that renders a visible cursor dot,
a fading motion trail, a click ripple, and short action-label bubbles (e.g.
`Typing…`, `Hovering…`) so that test recordings and traces are human-readable
— especially useful for reviewing agent-generated Playwright scripts.

The overlay is **purely visual**: all overlay elements are
`pointer-events: none`, and Playwright still drives real clicks, fills, and
hovers through the normal `Locator` APIs. Action semantics are unchanged.

---

## Why

When an LLM agent writes a Playwright test and you scrub through the video
trace later, it's hard to tell *which* element a given `click` / `fill` /
`hover` landed on — the pointer is invisible and the page transitions by
the time the action lands. `pw-cursor-overlay` injects a visible cursor,
motion trail, and action label so a human reviewer can follow along in real
time without a second debugger window.

In CI (i.e. when neither `PW_LIVE_DEBUG=1` nor `PW_TRACE=1` is set), every
overlay method collapses to the plain Playwright locator call with zero
evaluate roundtrips — there is no runtime cost in steady-state test runs.

---

## Install

```bash
npm install --save-dev pw-cursor-overlay
# or: pnpm add -D pw-cursor-overlay
# or: yarn add -D pw-cursor-overlay
```

Peer dependency: `@playwright/test >= 1.40.0`. Node `>= 18.17.0`.

---

## Quickstart

```ts
// example.spec.ts
import { test, expect } from "@playwright/test";
import { OverlayController } from "pw-cursor-overlay";

test("login flow", async ({ page }) => {
  const cursor = new OverlayController(page);
  await cursor.inject();              // before the first page.goto()
  await page.goto("https://example.com/login");

  await cursor.fill(page.getByLabel("Email"), "agent@example.com");
  await cursor.fill(page.getByLabel("Password"), "hunter2");
  await cursor.click(page.getByRole("button", { name: "Sign in" }));

  await expect(page).toHaveURL(/\/dashboard/);
});
```

Turn the overlay **on** while you're debugging:

```bash
PW_LIVE_DEBUG=1 npx playwright test --headed example.spec.ts
# or, when you only want overlay marks in the trace file:
PW_TRACE=1 npx playwright test --trace on example.spec.ts
```

Turn it **off** in CI — just don't set either env var. The spec behaves
exactly like the equivalent plain-Playwright version.

---

## Playwright config helper

`overlayConfig(userConfig)` returns a `defineConfig(...)` with the
overlay-friendly defaults pre-applied (trace artefacts tuned for debug
runs, video `retain-on-failure` when `PW_LIVE_DEBUG=1`, `headed: true` in
live-debug mode). Use it from `playwright.config.ts`:

```ts
import { overlayConfig } from "pw-cursor-overlay";

export default overlayConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://localhost:3000",
  },
});
```

Anything you pass in overrides the defaults via a shallow merge on each
top-level key (e.g. `use`, `reporter`, `projects`).

---

## API

### `OverlayController(page)`

The main entry point. One instance per `Page`; typically constructed
inside a Playwright fixture.

| Method | Behaviour when overlay is disabled | Behaviour when overlay is enabled |
|---|---|---|
| `inject()` | noop | injects the bootstrap script via `page.addInitScript` + `page.evaluate` for the current document. Call once before `page.goto()`. |
| `click(locator, label?)` | `locator.click()` | trial-click → move cursor → pause → real click → ripple. Optional label bubble. |
| `fill(locator, text, label?)` | `locator.fill(text)` | scroll-into-view → move cursor → label `"Typing…"` → real fill. |
| `hover(locator, label?)` | `locator.hover()` | scroll-into-view → move cursor → label `"Hovering…"` → real hover. |
| `scroll(locator, delta, label?)` | `locator.evaluate(scrollBy)` | scroll-into-view → move cursor → label `"Scrolling…"` → real `scrollBy`. |
| `select(locator, value, label?)` | `locator.selectOption(value)` | scroll-into-view → move cursor → label `"Selecting…"` → real `selectOption`. |

`scroll` accepts a number (vertical scroll in pixels) or
`{ x?: number; y?: number }`. `select`'s `value` shape matches
Playwright's [`locator.selectOption`](https://playwright.dev/docs/api/class-locator#locator-select-option).

### Top-level exports

```ts
import {
  OverlayController,      // main API
  overlayConfig,          // playwright.config helper
  injectCursorOverlay,    // low-level: inject the bootstrap script
  moveCursorOverlay,      // low-level: seed the cursor to (x, y)
  clickWithOverlay,       // @deprecated function-style click shim
  getOverlayController,   // @deprecated per-page WeakMap lookup
} from "pw-cursor-overlay";

import type {
  CursorPosition,
  OverlayActionOptions,
  OverlayActionResult,
  ScrollDelta,
  SelectOptionDescriptor,
  SelectOptionValue,
} from "pw-cursor-overlay";
```

---

## Environment flags

| Env var | Behaviour |
|---|---|
| `PW_LIVE_DEBUG=1` | Overlay on, slower timing tuned for video (600ms pause). Pair with `--headed`. |
| `PW_TRACE=1` | Overlay on, faster timing tuned for trace snapshots (150ms pause). Pair with `--trace on`. |
| *(neither)* | Overlay off. Every method calls through to the plain Playwright locator API. |

Setting both is fine; live-debug timing wins.

---

## How it works

On `inject()`, a bootstrap script mounts four DOM elements on the page:

- `#__pw_cursor` — the cursor dot (`div`, 20×20, radial gradient)
- `#__pw_cursor_trail` — an SVG overlay for the fading motion trail
- `#__pw_cursor_label` — a positioned speech-bubble `div` for action labels
- ripple clones — created per click, tagged `data-pw-cursor-ripple="1"`

All four are `pointer-events: none` and sit in their own top-level
container — they do not intercept clicks, focus, or scroll events.

Every overlay method then:

1. Asserts actionability (trial-click for `click`,
   `scrollIntoViewIfNeeded` for the others).
2. Computes the element's `boundingBox()` centre.
3. Animates the cursor to that centre via CSS transitions, optionally
   showing the label bubble.
4. Pauses so video / trace captures a stable frame of the cursor on
   the target.
5. Runs the real Playwright action.
6. For `click`, fires a short ripple at the post-action position.
7. Hides the label — in a `finally` block, so a failing action still
   leaves a clean overlay.

The whole pipeline is gated by an `OVERLAY_ENABLED` check at the top of
every public method. When disabled, the method collapses to the plain
Playwright call with no evaluate roundtrips.

---

## Examples

See [`examples/minimal/`](./examples/minimal/) for a runnable single-spec
demo you can clone and adapt.

---

## Migrating from `ai-lite-demo`'s `debugCursor.ts`

If you previously imported from
`tests/e2e/support/debugCursor` in `hjiangcpp/ai-lite-demo`:

```ts
// before
import { clickWithOverlay, injectCursorOverlay } from "./support/debugCursor";

// after
import { clickWithOverlay, injectCursorOverlay } from "pw-cursor-overlay";
```

The deprecated function-style helpers (`clickWithOverlay`,
`getOverlayController`) keep working identically. New code should hold
its own `OverlayController` instance, typically in a Playwright fixture:

```ts
import { test as base } from "@playwright/test";
import { OverlayController } from "pw-cursor-overlay";

export const test = base.extend<{ cursor: OverlayController }>({
  cursor: async ({ page }, use) => {
    const cursor = new OverlayController(page);
    await cursor.inject();
    await use(cursor);
  },
});
```

---

## Contributing

Small PRs, one feature per branch. Run `npm run typecheck`,
`npm run lint`, `npm run build`, and `npm test` before pushing. A
GitHub workflow enforces a 1000-line cap per PR (excluding lockfiles,
logs, `dist/`, and test artefacts).

---

## License

MIT © hjiang — see [LICENSE](./LICENSE).
