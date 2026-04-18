// DOM-side observer + Node-side snapshot/assertion helpers used by the
// overlay regression suite. The observer installs MutationObservers against
// the four overlay elements (cursor dot, trail SVG, label bubble, ripple
// elements) and records every style / text / DOM event into a shared
// `window.__pwCursorDebug` table so tests can assert lifecycle ordering
// without any flaky `waitForTimeout`.

import { expect, type Page } from "@playwright/test";

export type OverlaySnapshot = {
  display: string;
  left: string;
  top: string;
};

export type OverlayPosition = {
  left: string;
  top: string;
};

export type TrailSnapshot = {
  display: string;
  segmentCount: number;
};

export type CursorStyleSnapshot = {
  pointerEvents: string;
};

export type TrailStyleSnapshot = {
  pointerEvents: string;
};

export type LabelSnapshot = {
  display: string;
  left: string;
  top: string;
  text: string;
};

export type RippleEvent = {
  phase: "added" | "removed";
  left: string;
  top: string;
};

type BoxLike = {
  x: number;
  y: number;
  width: number;
  height: number;
} | null;

/**
 * Install a DOM-side observer that records every style/text/childList
 * change on the overlay elements into `window.__pwCursorDebug`. Call once
 * after `gotoFixture` and before any overlay-driven action.
 *
 * Idempotent — safe to call multiple times per page. Later calls no-op the
 * attach step but still ensure the ripple-level observer is live.
 */
export async function installOverlayObserver(page: Page): Promise<void> {
  await page.evaluate(() => {
    const windowWithDebug = window as Window & {
      __pwCursorDebug?: {
        cursorAttached: boolean;
        labelAttached: boolean;
        trailAttached: boolean;
        rippleAttached: boolean;
        positions: OverlayPosition[];
        trailSnapshots: TrailSnapshot[];
        labelSnapshots: LabelSnapshot[];
        rippleEvents: RippleEvent[];
      };
    };

    windowWithDebug.__pwCursorDebug ??= {
      cursorAttached: false,
      labelAttached: false,
      trailAttached: false,
      rippleAttached: false,
      positions: [],
      trailSnapshots: [],
      labelSnapshots: [],
      rippleEvents: [],
    };

    const state = windowWithDebug.__pwCursorDebug;

    function recordCursor(el: HTMLElement): void {
      state.positions.push({ left: el.style.left, top: el.style.top });
    }

    function recordLabel(el: HTMLElement): void {
      state.labelSnapshots.push({
        display: el.style.display,
        left: el.style.left,
        top: el.style.top,
        text: el.textContent ?? "",
      });
    }

    function recordTrail(el: SVGSVGElement): void {
      state.trailSnapshots.push({
        display: el.style.display,
        segmentCount: el.querySelectorAll('[data-pw-cursor-trail-segment="1"]')
          .length,
      });
    }

    function recordRipple(phase: RippleEvent["phase"], el: HTMLElement): void {
      state.rippleEvents.push({
        phase,
        left: el.style.left,
        top: el.style.top,
      });
    }

    function findRippleElements(node: Node): HTMLElement[] {
      if (!(node instanceof HTMLElement)) return [];

      const ripples: HTMLElement[] = [];
      if (node.getAttribute("data-pw-cursor-ripple") === "1") {
        ripples.push(node);
      }
      node
        .querySelectorAll('[data-pw-cursor-ripple="1"]')
        .forEach((ripple) => {
          if (ripple instanceof HTMLElement) ripples.push(ripple);
        });
      return ripples;
    }

    function attachCursor(el: HTMLElement): void {
      if (state.cursorAttached) return;
      state.cursorAttached = true;
      recordCursor(el);
      new MutationObserver(() => recordCursor(el)).observe(el, {
        attributes: true,
        attributeFilter: ["style"],
      });
    }

    function attachLabel(el: HTMLElement): void {
      if (state.labelAttached) return;
      state.labelAttached = true;
      recordLabel(el);
      new MutationObserver(() => recordLabel(el)).observe(el, {
        attributes: true,
        attributeFilter: ["style"],
        childList: true,
        characterData: true,
        subtree: true,
      });
    }

    function attachTrail(el: SVGSVGElement): void {
      if (state.trailAttached) return;
      state.trailAttached = true;
      recordTrail(el);
      new MutationObserver(() => recordTrail(el)).observe(el, {
        attributes: true,
        attributeFilter: ["style", "viewBox"],
        childList: true,
        subtree: true,
      });
    }

    const existingCursor = document.getElementById("__pw_cursor");
    if (existingCursor instanceof HTMLElement) attachCursor(existingCursor);

    const existingTrail = document.getElementById("__pw_cursor_trail");
    if (existingTrail instanceof SVGSVGElement) attachTrail(existingTrail);

    const existingLabel = document.getElementById("__pw_cursor_label");
    if (existingLabel instanceof HTMLElement) attachLabel(existingLabel);

    if (
      !(state.cursorAttached && state.labelAttached && state.trailAttached)
    ) {
      new MutationObserver((_, observer) => {
        const cursor = document.getElementById("__pw_cursor");
        if (cursor instanceof HTMLElement) attachCursor(cursor);

        const trail = document.getElementById("__pw_cursor_trail");
        if (trail instanceof SVGSVGElement) attachTrail(trail);

        const label = document.getElementById("__pw_cursor_label");
        if (label instanceof HTMLElement) attachLabel(label);

        if (
          state.cursorAttached &&
          state.labelAttached &&
          state.trailAttached
        ) {
          observer.disconnect();
        }
      }).observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }

    if (!state.rippleAttached) {
      state.rippleAttached = true;
      new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            findRippleElements(node).forEach((ripple) =>
              recordRipple("added", ripple),
            );
          });
          mutation.removedNodes.forEach((node) => {
            findRippleElements(node).forEach((ripple) =>
              recordRipple("removed", ripple),
            );
          });
        });
      }).observe(document.documentElement, { childList: true, subtree: true });
    }
  });
}

export async function getOverlaySnapshot(
  page: Page,
): Promise<OverlaySnapshot | null> {
  return page.evaluate(() => {
    const cursor = document.getElementById("__pw_cursor");
    if (!(cursor instanceof HTMLElement)) return null;
    return {
      display: cursor.style.display,
      left: cursor.style.left,
      top: cursor.style.top,
    };
  });
}

export async function getOverlayPositions(
  page: Page,
): Promise<OverlayPosition[]> {
  return page.evaluate(() => {
    const windowWithDebug = window as Window & {
      __pwCursorDebug?: { positions: OverlayPosition[] };
    };
    return windowWithDebug.__pwCursorDebug?.positions ?? [];
  });
}

export async function getLabelSnapshots(page: Page): Promise<LabelSnapshot[]> {
  return page.evaluate(() => {
    const windowWithDebug = window as Window & {
      __pwCursorDebug?: { labelSnapshots: LabelSnapshot[] };
    };
    return windowWithDebug.__pwCursorDebug?.labelSnapshots ?? [];
  });
}

export async function getTrailSnapshots(page: Page): Promise<TrailSnapshot[]> {
  return page.evaluate(() => {
    const windowWithDebug = window as Window & {
      __pwCursorDebug?: { trailSnapshots: TrailSnapshot[] };
    };
    return windowWithDebug.__pwCursorDebug?.trailSnapshots ?? [];
  });
}

export async function getRippleEvents(page: Page): Promise<RippleEvent[]> {
  return page.evaluate(() => {
    const windowWithDebug = window as Window & {
      __pwCursorDebug?: { rippleEvents: RippleEvent[] };
    };
    return windowWithDebug.__pwCursorDebug?.rippleEvents ?? [];
  });
}

export async function getTrailSnapshot(
  page: Page,
): Promise<TrailSnapshot | null> {
  return page.evaluate(() => {
    const trail = document.getElementById("__pw_cursor_trail");
    if (!(trail instanceof SVGSVGElement)) return null;
    return {
      display: trail.style.display,
      segmentCount: trail.querySelectorAll('[data-pw-cursor-trail-segment="1"]')
        .length,
    };
  });
}

export async function getRippleCount(page: Page): Promise<number> {
  return page.evaluate(
    () => document.querySelectorAll('[data-pw-cursor-ripple="1"]').length,
  );
}

export async function clearOverlayPositions(page: Page): Promise<void> {
  await page.evaluate(() => {
    const windowWithDebug = window as Window & {
      __pwCursorDebug?: { positions: OverlayPosition[] };
    };
    if (windowWithDebug.__pwCursorDebug) {
      windowWithDebug.__pwCursorDebug.positions = [];
    }
  });
}

export async function getCursorStyleSnapshot(
  page: Page,
): Promise<CursorStyleSnapshot | null> {
  return page.evaluate(() => {
    const cursor = document.getElementById("__pw_cursor");
    if (!(cursor instanceof HTMLElement)) return null;
    const styles = window.getComputedStyle(cursor);
    return { pointerEvents: styles.pointerEvents };
  });
}

export async function getTrailStyleSnapshot(
  page: Page,
): Promise<TrailStyleSnapshot | null> {
  return page.evaluate(() => {
    const trail = document.getElementById("__pw_cursor_trail");
    if (!(trail instanceof SVGSVGElement)) return null;
    const styles = window.getComputedStyle(trail);
    return { pointerEvents: styles.pointerEvents };
  });
}

/**
 * Assert the given snapshot sits at the centre of the given bounding box
 * with sub-pixel tolerance. Both inputs are nullable; `null` means "page
 * reported no element / no bounding box" and fails the assertion.
 */
export function expectOverlayAtCenter(
  snapshot: { left: string; top: string } | null,
  box: BoxLike,
): void {
  expect(box).not.toBeNull();
  expect(snapshot).not.toBeNull();
  expect(
    Math.abs(
      Number.parseFloat(snapshot?.left ?? "0") -
        (box?.x ?? 0) -
        (box?.width ?? 0) / 2,
    ),
  ).toBeLessThan(1);
  expect(
    Math.abs(
      Number.parseFloat(snapshot?.top ?? "0") -
        (box?.y ?? 0) -
        (box?.height ?? 0) / 2,
    ),
  ).toBeLessThan(1);
}

/**
 * Assert the "Typing..." / "Hovering..." / ... label bubble flipped to
 * visible with the expected text and then flipped back to hidden.
 * Returns the latest `display: block` snapshot for follow-up position
 * assertions (`expectOverlayAtCenter` against the target locator's box).
 */
export async function expectLabelBubbleLifecycle(
  page: Page,
  text: string,
): Promise<LabelSnapshot> {
  const snapshots = await getLabelSnapshots(page);
  const firstVisibleIndex = snapshots.findIndex(
    (snapshot) => snapshot.display === "block" && snapshot.text === text,
  );

  expect(firstVisibleIndex).toBeGreaterThanOrEqual(0);
  expect(
    snapshots
      .slice(firstVisibleIndex + 1)
      .some((snapshot) => snapshot.display === "none"),
  ).toBe(true);

  const visibleSnapshots = snapshots.filter(
    (snapshot) => snapshot.display === "block" && snapshot.text === text,
  );
  const latestVisible = visibleSnapshots.at(-1);

  expect(latestVisible).toBeDefined();
  return latestVisible as LabelSnapshot;
}

/** Assert a trail appeared during the move and faded out afterwards. */
export async function expectTrailLifecycle(page: Page): Promise<void> {
  await expect
    .poll(async () => {
      const snapshots = await getTrailSnapshots(page);
      return snapshots.some((snapshot) => snapshot.segmentCount > 0);
    })
    .toBe(true);

  const activeSnapshot = (await getTrailSnapshots(page)).find(
    (snapshot) => snapshot.segmentCount > 0,
  );
  expect(activeSnapshot?.display).toBe("block");

  await expect
    .poll(async () => (await getTrailSnapshot(page))?.segmentCount ?? 0)
    .toBe(0);
  await expect
    .poll(async () => (await getTrailSnapshot(page))?.display ?? "none")
    .toBe("none");
}

/**
 * Assert a click ripple appeared at the element's centre and was later
 * removed — both the `animationend` and `setTimeout` cleanup paths count.
 */
export async function expectRippleLifecycle(
  page: Page,
  box: BoxLike,
): Promise<void> {
  await expect
    .poll(async () => {
      const events = await getRippleEvents(page);
      return events.filter((event) => event.phase === "added").length;
    })
    .not.toBe(0);

  const addedRipple = (await getRippleEvents(page))
    .filter((event) => event.phase === "added")
    .at(-1);

  expectOverlayAtCenter(addedRipple ?? null, box);

  await expect.poll(() => getRippleCount(page)).toBe(0);
  await expect
    .poll(async () => {
      const events = await getRippleEvents(page);
      return events.filter((event) => event.phase === "removed").length;
    })
    .not.toBe(0);
}
