# minimal example

A single-spec Playwright project that demonstrates every
`OverlayController` method against a tiny self-contained HTML fixture.

No dev server, no product code — the demo loads the fixture via a
`data:text/html` URL, so you can clone just this folder and get a
runnable example.

## Run

From the root of this example:

```bash
npm install
npx playwright install --with-deps chromium

# CI-style run (overlay off, fast):
npx playwright test

# Debug run (overlay on, headed, video retained on failure):
PW_LIVE_DEBUG=1 npx playwright test --headed

# Trace-only run (overlay on, faster timing):
PW_TRACE=1 npx playwright test --trace on
```

In debug mode you'll see the cursor dot arrive at each target, a fading
motion trail along the path, a label bubble announcing the action
(`Typing…`, `Hovering…`, …), and a ripple on click.

## What the demo covers

- `OverlayController.click` on a `<button>`
- `OverlayController.fill` on an `<input>` with a `"Typing…"` label
- `OverlayController.hover` on a `<button>` with a `"Hovering…"` label
- `OverlayController.scroll` on a scrollable region with a
  `"Scrolling…"` label
- `OverlayController.select` on a `<select>` with a `"Selecting…"`
  label

It also shows the recommended fixture pattern: one `OverlayController`
per `Page`, constructed and `inject()`-ed via a `test.extend` fixture
so every spec gets a pre-wired `cursor` parameter.

## How this translates to a real project

Point the `test.beforeEach` `page.goto(...)` call at your app's URL,
replace the fixture-specific selectors (`#answer`, `#hover-target`, …)
with your own, and you're done. No changes to this project's
`playwright.config.ts` are required — `overlayConfig()` ships sensible
defaults.
