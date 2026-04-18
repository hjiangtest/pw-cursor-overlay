import type { Locator, Page } from "@playwright/test";

import {
  animateCursorOverlay,
  clearCursorOverlayTrail,
  getOverlayPosition,
  hideCursorActionLabel,
  setCursorOverlayPosition,
  showCursorActionLabel,
  showCursorClickRipple,
} from "./animation";
import {
  DEFAULT_ACTION_LABELS,
  OVERLAY_ENABLED,
  OVERLAY_PAUSE_MS,
} from "./env";
import { isExpectedEvaluateError } from "./errors";
import { ensureInjected, injectCursorOverlay } from "./injection";
import type {
  CursorPosition,
  NormalizedScrollDelta,
  OverlayActionOptions,
  OverlayActionResult,
  ScrollDelta,
  SelectOptionValue,
} from "./types";

function normalizeScrollDelta(delta: ScrollDelta): NormalizedScrollDelta {
  if (typeof delta === "number") {
    return { x: 0, y: delta };
  }
  return {
    x: delta.x ?? 0,
    y: delta.y ?? 0,
  };
}

function areSamePosition(a: CursorPosition, b: CursorPosition): boolean {
  return a.x === b.x && a.y === b.y;
}

async function getInitialCursorPosition(page: Page): Promise<CursorPosition> {
  // Prefer the configured viewport: it's fast and doesn't require a roundtrip
  // to the page, and it's accurate for non-resized windows.
  const viewport = page.viewportSize();
  if (viewport) {
    return { x: viewport.width / 2, y: viewport.height / 2 };
  }

  return page
    .evaluate(() => ({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    }))
    .catch((err: Error) => {
      if (isExpectedEvaluateError(err)) {
        return { x: 0, y: 0 };
      }
      throw err;
    });
}

async function getLocatorCenter(
  locator: Locator,
): Promise<CursorPosition | null> {
  const box = await locator.boundingBox();
  if (!box) return null;
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

async function getLocatorCenterBestEffort(
  locator: Locator,
): Promise<CursorPosition | null> {
  try {
    return await getLocatorCenter(locator);
  } catch {
    return null;
  }
}

async function scrollLocator(
  locator: Locator,
  delta: ScrollDelta,
): Promise<void> {
  const normalized = normalizeScrollDelta(delta);

  // This intentionally annotates an element's scroll position change.
  // It does not synthesize wheel / gesture input events.
  await locator.evaluate(
    (element, scroll: { x: number; y: number }) => {
      if (!(element instanceof HTMLElement)) {
        throw new Error(
          "[pw-cursor-overlay] OverlayController.scroll() expects an HTMLElement locator.",
        );
      }
      element.scrollBy({ left: scroll.x, top: scroll.y, behavior: "auto" });
    },
    normalized,
  );
}

async function selectLocatorOption(
  locator: Locator,
  value: SelectOptionValue,
): Promise<void> {
  await locator.selectOption(value);
}

/**
 * High-level overlay-aware wrapper around common Playwright actions.
 *
 * Every action on this controller:
 *   1. Asserts actionability (e.g. trial-click for click).
 *   2. Computes the element's bounding-box centre.
 *   3. Animates the overlay cursor + label bubble there.
 *   4. Runs the real Playwright action.
 *   5. Hides the label and (for clicks) fires a ripple at the final spot.
 *
 * When neither `PW_LIVE_DEBUG=1` nor `PW_TRACE=1` is set, every method
 * collapses to the plain Playwright call with zero evaluate roundtrips.
 */
export class OverlayController {
  constructor(private readonly page: Page) {}

  /** Install the overlay scripts. Call before `page.goto()` for best UX. */
  async inject(): Promise<void> {
    await injectCursorOverlay(this.page);
  }

  async click(locator: Locator, label?: string): Promise<void> {
    if (!OVERLAY_ENABLED) {
      await locator.click();
      return;
    }

    // Assert actionability without side-effects before showing the overlay.
    await locator.click({ trial: true });

    const target = await getLocatorCenter(locator);
    await this.performOverlayAction(target, () => locator.click(), {
      label,
      resolveActionPosition: () => getLocatorCenterBestEffort(locator),
      showClickRipple: true,
    });
  }

  async fill(locator: Locator, text: string, label?: string): Promise<void> {
    if (!OVERLAY_ENABLED) {
      await locator.fill(text);
      return;
    }

    await locator.scrollIntoViewIfNeeded();
    const target = await getLocatorCenter(locator);
    await this.performOverlayAction(target, () => locator.fill(text), {
      label: label ?? DEFAULT_ACTION_LABELS.fill,
    });
  }

  async hover(locator: Locator, label?: string): Promise<void> {
    if (!OVERLAY_ENABLED) {
      await locator.hover();
      return;
    }

    await locator.scrollIntoViewIfNeeded();
    const target = await getLocatorCenter(locator);
    await this.performOverlayAction(
      target,
      async () => {
        await locator.hover();
        return getLocatorCenterBestEffort(locator);
      },
      {
        label: label ?? DEFAULT_ACTION_LABELS.hover,
      },
    );
  }

  async scroll(
    locator: Locator,
    delta: ScrollDelta,
    label?: string,
  ): Promise<void> {
    if (!OVERLAY_ENABLED) {
      await scrollLocator(locator, delta);
      return;
    }

    await locator.scrollIntoViewIfNeeded();
    const target = await getLocatorCenter(locator);
    await this.performOverlayAction(
      target,
      () => scrollLocator(locator, delta),
      {
        label: label ?? DEFAULT_ACTION_LABELS.scroll,
      },
    );
  }

  async select(
    locator: Locator,
    value: SelectOptionValue,
    label?: string,
  ): Promise<void> {
    if (!OVERLAY_ENABLED) {
      await selectLocatorOption(locator, value);
      return;
    }

    await locator.scrollIntoViewIfNeeded();
    const target = await getLocatorCenter(locator);
    await this.performOverlayAction(
      target,
      () => selectLocatorOption(locator, value),
      {
        label: label ?? DEFAULT_ACTION_LABELS.select,
      },
    );
  }

  private async moveCursorTo(target: CursorPosition): Promise<void> {
    const start =
      getOverlayPosition(this.page) ??
      (await getInitialCursorPosition(this.page));
    await animateCursorOverlay(this.page, start, target);
  }

  private async performOverlayAction(
    target: CursorPosition | null,
    action: () => Promise<OverlayActionResult>,
    options?: OverlayActionOptions,
  ): Promise<void> {
    await ensureInjected(this.page);
    await clearCursorOverlayTrail(this.page);

    const start =
      getOverlayPosition(this.page) ??
      (await getInitialCursorPosition(this.page));

    await setCursorOverlayPosition(this.page, start, 0);

    if (options?.label) {
      await showCursorActionLabel(this.page, options.label, start);
    }

    let finalPosition = target ?? start;

    if (target) {
      if (areSamePosition(start, target)) {
        await setCursorOverlayPosition(this.page, target, 0);
      } else {
        await this.moveCursorTo(target);
      }
      await this.page.waitForTimeout(OVERLAY_PAUSE_MS);
    } else if (options?.label) {
      await this.page.waitForTimeout(OVERLAY_PAUSE_MS);
    }

    try {
      const resolvedActionPosition = await options?.resolveActionPosition?.();
      if (
        resolvedActionPosition &&
        !areSamePosition(resolvedActionPosition, finalPosition)
      ) {
        await setCursorOverlayPosition(this.page, resolvedActionPosition, 0);
        finalPosition = resolvedActionPosition;
      }

      const actionPosition = await action();
      if (actionPosition && !areSamePosition(actionPosition, finalPosition)) {
        await setCursorOverlayPosition(this.page, actionPosition, 0);
        finalPosition = actionPosition;
      }

      if (options?.showClickRipple) {
        await showCursorClickRipple(this.page, finalPosition);
      }
    } finally {
      if (options?.label) {
        await hideCursorActionLabel(this.page, finalPosition);
      }
    }
  }
}
