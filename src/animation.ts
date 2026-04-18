import type { Page } from "@playwright/test";

import {
  CURSOR_ELEMENT_ID,
  LABEL_ELEMENT_ID,
  OVERLAY_ENABLED,
  OVERLAY_MOVE_MS,
  RIPPLE_ANIMATION_MS,
  RIPPLE_CLASS_NAME,
  RIPPLE_CLEANUP_BUFFER_MS,
  RIPPLE_DATA_ATTRIBUTE,
  getCursorTransition,
  getLabelTransition,
} from "./env";
import { rethrowUnexpectedEvaluateError } from "./errors";
import type { CursorPosition } from "./types";

// Per-page last-known cursor position. Used by animateCursorOverlay to pick a
// start point and by OverlayController (PR 5) to resume a stable overlay
// position after DOM updates.
const overlayPositions = new WeakMap<Page, CursorPosition>();

export function getOverlayPosition(page: Page): CursorPosition | null {
  const position = overlayPositions.get(page);
  return position ? { ...position } : null;
}

export function rememberOverlayPosition(
  page: Page,
  position: CursorPosition,
): void {
  overlayPositions.set(page, { ...position });
}

/**
 * Snap the overlay cursor + label to an absolute viewport position. Used
 * before animated moves and whenever the controller needs to place the
 * cursor without a visible transition (e.g. right before a click ripple).
 */
export async function setCursorOverlayPosition(
  page: Page,
  position: CursorPosition,
  transitionMs: number,
): Promise<void> {
  if (!OVERLAY_ENABLED) return;

  await page.evaluate(
    ({
      cursorId,
      labelId,
      px,
      py,
      cursorTransition,
      labelTransition,
    }: {
      cursorId: string;
      labelId: string;
      px: number;
      py: number;
      cursorTransition: string;
      labelTransition: string;
    }) => {
      const cursor = document.getElementById(cursorId);
      if (cursor instanceof HTMLElement) {
        cursor.style.display = "block";
        cursor.style.transition = cursorTransition;
        cursor.style.left = `${px}px`;
        cursor.style.top = `${py}px`;
      }

      const label = document.getElementById(labelId);
      if (label instanceof HTMLElement) {
        label.style.transition = labelTransition;
        label.style.left = `${px}px`;
        label.style.top = `${py}px`;
      }
    },
    {
      cursorId: CURSOR_ELEMENT_ID,
      labelId: LABEL_ELEMENT_ID,
      px: position.x,
      py: position.y,
      cursorTransition: getCursorTransition(transitionMs),
      labelTransition: getLabelTransition(transitionMs),
    },
  );

  rememberOverlayPosition(page, position);
}

/**
 * Wipe the motion-trail state (trail points + RAF loop) via the browser-side
 * __pwCursorOverlayApi. Safe to call if the overlay hasn't been injected
 * yet — the injected API is optional-chained.
 */
export async function clearCursorOverlayTrail(page: Page): Promise<void> {
  if (!OVERLAY_ENABLED) return;

  await page
    .evaluate(() => {
      const windowWithOverlay = window as Window & {
        __pwCursorOverlayApi?: {
          clearTrail?: () => void;
        };
      };

      windowWithOverlay.__pwCursorOverlayApi?.clearTrail?.();
    })
    .catch((err: Error) => {
      rethrowUnexpectedEvaluateError(err);
    });
}

/**
 * Animate the overlay cursor + label from `start` to `target` with the
 * standard `OVERLAY_MOVE_MS` duration and kick off the motion-trail RAF
 * loop. The two-phase transition (snap-to-start then transition-to-target)
 * forces the browser to pick up the new `left`/`top` as a transition
 * target rather than an instant jump.
 */
export async function animateCursorOverlay(
  page: Page,
  start: CursorPosition,
  target: CursorPosition,
): Promise<void> {
  if (!OVERLAY_ENABLED) return;

  await page.evaluate(
    ({
      cursorId,
      labelId,
      startX,
      startY,
      targetX,
      targetY,
      zeroCursorTransition,
      zeroLabelTransition,
      cursorTransition,
      labelTransition,
      moveDurationMs,
    }: {
      cursorId: string;
      labelId: string;
      startX: number;
      startY: number;
      targetX: number;
      targetY: number;
      zeroCursorTransition: string;
      zeroLabelTransition: string;
      cursorTransition: string;
      labelTransition: string;
      moveDurationMs: number;
    }) => {
      const cursor = document.getElementById(cursorId);
      if (cursor instanceof HTMLElement) {
        cursor.style.display = "block";
        cursor.style.transition = zeroCursorTransition;
        cursor.style.left = `${startX}px`;
        cursor.style.top = `${startY}px`;
      }

      const label = document.getElementById(labelId);
      if (label instanceof HTMLElement) {
        label.style.transition = zeroLabelTransition;
        label.style.left = `${startX}px`;
        label.style.top = `${startY}px`;
      }

      // Force a reflow so the subsequent transition kicks in from `start`
      // rather than being folded into the snap above.
      void document.documentElement.offsetWidth;

      if (cursor instanceof HTMLElement) {
        cursor.style.transition = cursorTransition;
        cursor.style.left = `${targetX}px`;
        cursor.style.top = `${targetY}px`;
      }

      if (label instanceof HTMLElement) {
        label.style.transition = labelTransition;
        label.style.left = `${targetX}px`;
        label.style.top = `${targetY}px`;
      }

      const windowWithOverlay = window as Window & {
        __pwCursorOverlayApi?: {
          startTrailMotion?: (durationMs: number) => void;
        };
      };
      windowWithOverlay.__pwCursorOverlayApi?.startTrailMotion?.(moveDurationMs);
    },
    {
      cursorId: CURSOR_ELEMENT_ID,
      labelId: LABEL_ELEMENT_ID,
      startX: start.x,
      startY: start.y,
      targetX: target.x,
      targetY: target.y,
      zeroCursorTransition: getCursorTransition(0),
      zeroLabelTransition: getLabelTransition(0),
      cursorTransition: getCursorTransition(OVERLAY_MOVE_MS),
      labelTransition: getLabelTransition(OVERLAY_MOVE_MS),
      moveDurationMs: OVERLAY_MOVE_MS,
    },
  );

  rememberOverlayPosition(page, target);
}

/** Show the label bubble with `text` anchored at `position`. */
export async function showCursorActionLabel(
  page: Page,
  label: string,
  position: CursorPosition,
): Promise<void> {
  if (!OVERLAY_ENABLED) return;

  await page
    .evaluate(
      ({
        labelId,
        text,
        px,
        py,
      }: {
        labelId: string;
        text: string;
        px: number;
        py: number;
      }) => {
        const el = document.getElementById(labelId);
        if (!(el instanceof HTMLElement)) return;
        el.textContent = text;
        el.style.left = `${px}px`;
        el.style.top = `${py}px`;
        el.style.display = "block";
      },
      {
        labelId: LABEL_ELEMENT_ID,
        text: label,
        px: position.x,
        py: position.y,
      },
    )
    .catch((err: Error) => {
      rethrowUnexpectedEvaluateError(err);
    });
}

/** Hide the label bubble, leaving it positioned where the cursor is. */
export async function hideCursorActionLabel(
  page: Page,
  position: CursorPosition,
): Promise<void> {
  if (!OVERLAY_ENABLED) return;

  await page
    .evaluate(
      ({
        labelId,
        px,
        py,
      }: {
        labelId: string;
        px: number;
        py: number;
      }) => {
        const el = document.getElementById(labelId);
        if (!(el instanceof HTMLElement)) return;
        el.style.left = `${px}px`;
        el.style.top = `${py}px`;
        el.style.display = "none";
        el.textContent = "";
      },
      {
        labelId: LABEL_ELEMENT_ID,
        text: "",
        px: position.x,
        py: position.y,
      },
    )
    .catch((err: Error) => {
      rethrowUnexpectedEvaluateError(err);
    });
}

/**
 * Fire a click-ripple animation at `position`. The ripple element cleans
 * itself up when the CSS animation ends, with a timeout fallback so the
 * DOM never grows unbounded if `animationend` is missed (e.g. when the
 * tab is backgrounded).
 */
export async function showCursorClickRipple(
  page: Page,
  position: CursorPosition,
): Promise<void> {
  if (!OVERLAY_ENABLED) return;

  await page
    .evaluate(
      ({
        px,
        py,
        rippleClassName,
        rippleAttribute,
        cleanupDelayMs,
      }: {
        px: number;
        py: number;
        rippleClassName: string;
        rippleAttribute: string;
        cleanupDelayMs: number;
      }) => {
        const ripple = document.createElement("div");
        ripple.className = rippleClassName;
        ripple.setAttribute(rippleAttribute, "1");
        ripple.style.left = `${px}px`;
        ripple.style.top = `${py}px`;

        let cleanupTimer = 0;
        const cleanup = () => {
          if (cleanupTimer) {
            window.clearTimeout(cleanupTimer);
            cleanupTimer = 0;
          }

          if (ripple.isConnected) {
            ripple.remove();
          }
        };

        ripple.addEventListener("animationend", cleanup, { once: true });
        cleanupTimer = window.setTimeout(cleanup, cleanupDelayMs);
        (document.body ?? document.documentElement).appendChild(ripple);
      },
      {
        px: position.x,
        py: position.y,
        rippleClassName: RIPPLE_CLASS_NAME,
        rippleAttribute: RIPPLE_DATA_ATTRIBUTE,
        cleanupDelayMs: RIPPLE_ANIMATION_MS + RIPPLE_CLEANUP_BUFFER_MS,
      },
    )
    .catch((err: Error) => {
      rethrowUnexpectedEvaluateError(err);
    });
}

/**
 * Low-level primitive — snaps the overlay dot to (x, y) in viewport coords
 * with no animation. Exposed for callers that want to drive the cursor
 * position manually. Prefer `OverlayController` (PR 5) for typical usage.
 *
 * @deprecated Use `OverlayController` for interaction-level cursor movement.
 */
export async function moveCursorOverlay(
  page: Page,
  x: number,
  y: number,
): Promise<void> {
  await clearCursorOverlayTrail(page);
  await setCursorOverlayPosition(page, { x, y }, 0);
}
