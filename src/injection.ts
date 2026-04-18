import type { Page } from "@playwright/test";

import {
  CURSOR_ELEMENT_ID,
  LABEL_ELEMENT_ID,
  OVERLAY_ENABLED,
  OVERLAY_FADE_EASING,
  OVERLAY_STYLE_ELEMENT_ID,
  RIPPLE_ANIMATION_MS,
  RIPPLE_CLASS_NAME,
  TRAIL_ELEMENT_ID,
  TRAIL_FADE_MS,
  TRAIL_MAX_POINTS,
  TRAIL_SAMPLE_DISTANCE_PX,
  TRAIL_SEGMENT_DATA_ATTRIBUTE,
  getCursorTransition,
  getLabelTransition,
} from "./env";
import { isExpectedEvaluateError, rethrowUnexpectedEvaluateError } from "./errors";

// Browser-side bootstrap script. Idempotent: safe to re-run after navigation
// or in re-attached contexts. Intentionally defensive — no throws, no console
// output — so that it can be injected via addInitScript without leaking errors
// into the real page's logs.
const INJECT_SCRIPT = /* js */ `
(function () {
  function ensureStyle(id, cssText) {
    const existing = document.getElementById(id);
    if (existing instanceof HTMLStyleElement) {
      return existing;
    }

    const style = document.createElement('style');
    style.id = id;
    style.textContent = cssText;
    (document.head || document.documentElement).appendChild(style);
    return style;
  }

  function ensureElement(id, styleText) {
    const existing = document.getElementById(id);
    if (existing instanceof HTMLElement) {
      return existing;
    }

    const el = document.createElement('div');
    el.id = id;
    el.style.cssText = styleText;
    document.body.appendChild(el);
    return el;
  }

  function ensureSvgElement(id, styleText) {
    const existing = document.getElementById(id);
    if (existing instanceof SVGSVGElement) {
      return existing;
    }

    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.id = id;
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = styleText;
    document.body.appendChild(el);
    return el;
  }

  function getTrailElement() {
    const trail = document.getElementById('${TRAIL_ELEMENT_ID}');
    return trail instanceof SVGSVGElement ? trail : null;
  }

  function getOverlayState() {
    window.__pwCursorOverlayState ??= {
      motionUntil: 0,
      trailFrame: 0,
      trailPoints: [],
    };

    return window.__pwCursorOverlayState;
  }

  function trimTrailPoints(state, now) {
    state.trailPoints = state.trailPoints
      .filter((point) => now - point.t <= ${TRAIL_FADE_MS})
      .slice(-${TRAIL_MAX_POINTS});
  }

  function renderTrail() {
    const trail = getTrailElement();
    if (!trail) {
      return false;
    }

    const state = getOverlayState();
    const now = performance.now();
    trimTrailPoints(state, now);

    trail.replaceChildren();
    trail.setAttribute('viewBox', '0 0 ' + window.innerWidth + ' ' + window.innerHeight);

    let segmentCount = 0;
    for (let index = 1; index < state.trailPoints.length; index += 1) {
      const older = state.trailPoints[index - 1];
      const newer = state.trailPoints[index];
      const freshness = Math.max(0, 1 - (now - newer.t) / ${TRAIL_FADE_MS});

      if (freshness <= 0) {
        continue;
      }

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('${TRAIL_SEGMENT_DATA_ATTRIBUTE}', '1');
      line.setAttribute('x1', String(older.x));
      line.setAttribute('y1', String(older.y));
      line.setAttribute('x2', String(newer.x));
      line.setAttribute('y2', String(newer.y));
      line.setAttribute('stroke', 'rgba(99,102,241,0.74)');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('stroke-width', String(1.2 + freshness * 4));
      line.setAttribute('opacity', String(0.06 + freshness * 0.34));
      trail.appendChild(line);
      segmentCount += 1;
    }

    trail.style.display = segmentCount > 0 ? 'block' : 'none';
    return segmentCount > 0;
  }

  function readCursorPosition() {
    const cursor = document.getElementById('${CURSOR_ELEMENT_ID}');
    if (!(cursor instanceof HTMLElement) || cursor.style.display === 'none') {
      return null;
    }

    const computed = window.getComputedStyle(cursor);
    const x = Number.parseFloat(computed.left);
    const y = Number.parseFloat(computed.top);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }

    return { x, y };
  }

  function appendTrailPoint(position, force) {
    const state = getOverlayState();
    const now = performance.now();
    const lastPoint = state.trailPoints.at(-1);

    if (lastPoint) {
      const distance = Math.hypot(position.x - lastPoint.x, position.y - lastPoint.y);
      if (distance < ${TRAIL_SAMPLE_DISTANCE_PX}) {
        if (force) {
          lastPoint.t = now;
        }
        return;
      }
    }

    state.trailPoints.push({
      x: position.x,
      y: position.y,
      t: now,
    });
    trimTrailPoints(state, now);
  }

  function stopTrailLoop() {
    const state = getOverlayState();
    if (state.trailFrame) {
      window.cancelAnimationFrame(state.trailFrame);
      state.trailFrame = 0;
    }
  }

  function ensureOverlayApi() {
    window.__pwCursorOverlayApi ??= {
      clearTrail() {
        const state = getOverlayState();
        state.motionUntil = 0;
        state.trailPoints = [];
        stopTrailLoop();
        renderTrail();
      },
      startTrailMotion(durationMs) {
        const state = getOverlayState();
        const motionBufferMs = 34;
        const start = readCursorPosition();

        if (start) {
          appendTrailPoint(start, true);
        }

        state.motionUntil = Math.max(
          state.motionUntil,
          performance.now() + Math.max(durationMs, 0) + motionBufferMs,
        );

        if (state.trailFrame) {
          return;
        }

        const tick = () => {
          state.trailFrame = 0;

          if (performance.now() <= state.motionUntil) {
            const current = readCursorPosition();
            if (current) {
              appendTrailPoint(current, false);
            }
          }

          const hasTrail = renderTrail();
          if (performance.now() <= state.motionUntil || hasTrail) {
            state.trailFrame = window.requestAnimationFrame(tick);
          }
        };

        state.trailFrame = window.requestAnimationFrame(tick);
      },
    };

    return window.__pwCursorOverlayApi;
  }

  function mount() {
    ensureStyle('${OVERLAY_STYLE_ELEMENT_ID}', [
      '@keyframes __pw_cursor_ripple_keyframes {',
      '0% { transform: translate(-50%,-50%) scale(0.45); opacity: 0.78; }',
      '70% { opacity: 0.18; }',
      '100% { transform: translate(-50%,-50%) scale(2.85); opacity: 0; }',
      '}',
      '.${RIPPLE_CLASS_NAME} {',
      'position: fixed;',
      'z-index: 2147483646;',
      'pointer-events: none;',
      'width: 26px;',
      'height: 26px;',
      'border-radius: 50%;',
      'border: 2px solid rgba(99,102,241,0.72);',
      'background: rgba(99,102,241,0.08);',
      'box-shadow: 0 0 0 6px rgba(99,102,241,0.08);',
      'transform: translate(-50%,-50%) scale(0.45);',
      'animation: __pw_cursor_ripple_keyframes ${RIPPLE_ANIMATION_MS}ms ${OVERLAY_FADE_EASING} forwards;',
      '}',
    ].join(''));

    ensureSvgElement('${TRAIL_ELEMENT_ID}', [
      'position:fixed',
      'inset:0',
      'z-index:2147483645',
      'pointer-events:none',
      'width:100vw',
      'height:100vh',
      'overflow:visible',
      'display:none',
    ].join(';'));

    ensureElement('${CURSOR_ELEMENT_ID}', [
      'position:fixed',
      'z-index:2147483647',
      'pointer-events:none',
      'width:24px',
      'height:24px',
      'border-radius:50%',
      'background:linear-gradient(135deg,rgba(129,140,248,0.98),rgba(79,70,229,0.92))',
      'border:2px solid rgba(255,255,255,0.96)',
      'box-shadow:0 12px 24px rgba(79,70,229,0.28),0 0 0 6px rgba(99,102,241,0.16)',
      'transform:translate(-50%,-50%)',
      'transition:${getCursorTransition(0)}',
      'will-change:left,top',
      'display:none',
    ].join(';'));

    ensureElement('${LABEL_ELEMENT_ID}', [
      'position:fixed',
      'z-index:2147483647',
      'pointer-events:none',
      'padding:6px 10px',
      'border-radius:999px',
      'background:rgba(15,23,42,0.92)',
      'color:#fff',
      'font:600 12px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'white-space:nowrap',
      'box-shadow:0 12px 24px rgba(15,23,42,0.18)',
      'transform:translate(calc(-50% + 18px),calc(-100% - 12px))',
      'transition:${getLabelTransition(0)}',
      'will-change:left,top,opacity',
      'display:none',
    ].join(';'));

    ensureOverlayApi().clearTrail();
  }

  if (document.body) {
    mount();
  } else if (!window.__pwCursorOverlayInitialized) {
    window.__pwCursorOverlayInitialized = true;
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  }
})();
`;

// Tracks which pages have had the overlay injected so ensureInjected can
// self-heal when callers skipped the explicit injectCursorOverlay() step
// (e.g. legacy clickWithOverlay callers).
export const injectedPages = new WeakSet<Page>();

/**
 * Inject the cursor overlay into a page. Safe to call multiple times. Call
 * this once per page (before page.goto) so the overlay renders on the very
 * first frame.
 *
 * No-op when neither PW_LIVE_DEBUG nor PW_TRACE is set — zero cost in CI.
 */
export async function injectCursorOverlay(page: Page): Promise<void> {
  if (!OVERLAY_ENABLED) return;
  await page.addInitScript(INJECT_SCRIPT);
  // Best-effort inject into the already-loaded document so the overlay shows
  // up mid-test even if injectCursorOverlay was called after page.goto.
  // rethrowUnexpectedEvaluateError re-throws real bugs; navigation / teardown
  // errors are swallowed (expected when called before goto).
  await page.evaluate(INJECT_SCRIPT).catch((err: Error) => {
    rethrowUnexpectedEvaluateError(err);
  });
  // Only mark as injected after both steps succeed; a re-thrown error above
  // means the page won't be in the set and ensureInjected() will retry.
  injectedPages.add(page);
}

// Used by ensureInjected to detect navigations that wiped the overlay DOM.
export async function hasInjectedCursorElements(page: Page): Promise<boolean> {
  if (!OVERLAY_ENABLED) return false;

  return page
    .evaluate(
      ({
        cursorId,
        trailId,
        labelId,
        styleId,
      }: {
        cursorId: string;
        trailId: string;
        labelId: string;
        styleId: string;
      }) =>
        Boolean(document.getElementById(styleId)) &&
        Boolean(document.getElementById(trailId)) &&
        Boolean(document.getElementById(cursorId)) &&
        Boolean(document.getElementById(labelId)),
      {
        cursorId: CURSOR_ELEMENT_ID,
        trailId: TRAIL_ELEMENT_ID,
        labelId: LABEL_ELEMENT_ID,
        styleId: OVERLAY_STYLE_ELEMENT_ID,
      },
    )
    .catch((err: Error) => {
      if (isExpectedEvaluateError(err)) {
        return false;
      }
      throw err;
    });
}

// Ensures the overlay is present even if injectCursorOverlay was skipped.
// Controller actions call this defensively before every interaction.
export async function ensureInjected(page: Page): Promise<void> {
  const needsInjection =
    !injectedPages.has(page) || !(await hasInjectedCursorElements(page));

  if (needsInjection) {
    console.warn(
      "[pw-cursor-overlay] cursor overlay missing or not initialized — injecting now. " +
        "Call OverlayController.inject() (or injectCursorOverlay(page)) before page.goto() for reliable overlay on first load.",
    );
    await injectCursorOverlay(page);
  }
}
