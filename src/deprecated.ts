// Back-compat façade. These helpers let `ai-lite-demo` (and any other early
// consumer) migrate from the original function-style API to
// `OverlayController` gradually instead of in one big refactor.
//
// All functions here are `@deprecated` — they will be removed in a later
// major release once the last caller has been migrated.

import type { Locator, Page } from "@playwright/test";

import { OverlayController } from "./controller";

const overlayControllers = new WeakMap<Page, OverlayController>();

/**
 * Return the per-page shared OverlayController. Kept for callers that still
 * use `clickWithOverlay(page, locator)`; new code should hold its own
 * `new OverlayController(page)` reference (e.g. in a Playwright fixture).
 *
 * @deprecated Hold your own OverlayController instance (typically via a
 *   Playwright fixture) instead of looking it up per call.
 */
export function getOverlayController(page: Page): OverlayController {
  const existing = overlayControllers.get(page);
  if (existing) return existing;

  const created = new OverlayController(page);
  overlayControllers.set(page, created);
  return created;
}

/**
 * Visual click helper — Devin-style cursor overlay.
 *
 * Steps (when overlay is enabled):
 *   1. ensure overlay is injected (warns if injectCursorOverlay was skipped)
 *   2. trial-click to assert actionability without side-effects
 *   3. compute bounding-box centre and move the overlay dot there
 *   4. pause (600ms in video mode, 150ms in trace-only mode)
 *   5. perform the real click
 *
 * When overlay is disabled (default / CI) this is a plain locator.click().
 *
 * @deprecated Use `new OverlayController(page).click(locator)` instead.
 */
export async function clickWithOverlay(
  page: Page,
  locator: Locator,
): Promise<void> {
  await getOverlayController(page).click(locator);
}
