// Regression tests for OverlayController.click and the deprecated
// clickWithOverlay / moveCursorOverlay helpers.
//
// Each test uses a data:-URL HTML fixture (see tests/support/fixtures.ts)
// so the suite has no dependency on any dev server or product code, and
// installs the DOM-side observer (see tests/support/observer.ts) before
// the first overlay-driven action so lifecycle assertions see the
// complete style / mutation history.

import { expect, test } from "@playwright/test";

import {
  clickWithOverlay,
  injectCursorOverlay,
  moveCursorOverlay,
  OverlayController,
} from "../src";
import {
  buildCursorFixture,
  buildDetachingClickFixture,
  buildMovingClickFixture,
  gotoFixture,
} from "./support/fixtures";
import {
  clearOverlayPositions,
  expectOverlayAtCenter,
  expectRippleLifecycle,
  expectTrailLifecycle,
  getCursorStyleSnapshot,
  getOverlayPositions,
  getOverlaySnapshot,
  getRippleCount,
  getRippleEvents,
  getTrailSnapshot,
  getTrailSnapshots,
  getTrailStyleSnapshot,
  installOverlayObserver,
} from "./support/observer";

const OVERLAY_ENABLED =
  process.env.PW_LIVE_DEBUG === "1" || process.env.PW_TRACE === "1";

test("OverlayController.click emits a fading trail and ripple without hover side effects", async ({
  page,
}) => {
  const cursor = new OverlayController(page);

  await page.setViewportSize({ width: 1100, height: 900 });
  await cursor.inject();
  await gotoFixture(page, buildCursorFixture({ includeHoverTrap: true }));
  await installOverlayObserver(page);

  await cursor.click(page.getByRole("button", { name: "Target", exact: true }));

  await expect(page.locator("body")).toHaveAttribute("data-clicked", "1");
  await expect(page.locator("body")).toHaveAttribute("data-hover-count", "0");

  if (!OVERLAY_ENABLED) return;

  await expect.poll(async () => Boolean(await getOverlaySnapshot(page))).toBe(true);

  const targetBox = await page
    .getByRole("button", { name: "Target", exact: true })
    .boundingBox();
  const overlay = await getOverlaySnapshot(page);
  const cursorStyles = await getCursorStyleSnapshot(page);
  const trailStyles = await getTrailStyleSnapshot(page);

  expect(overlay?.display).toBe("block");
  expectOverlayAtCenter(overlay, targetBox);
  expect((await getOverlayPositions(page)).length).toBeGreaterThan(0);
  expect(cursorStyles?.pointerEvents).toBe("none");
  expect(trailStyles?.pointerEvents).toBe("none");
  await expectTrailLifecycle(page);
  await expectRippleLifecycle(page, targetBox);
});

test("OverlayController.click re-resolves moving targets before emitting the ripple", async ({
  page,
}) => {
  test.skip(
    !OVERLAY_ENABLED,
    "This regression specifically exercises the overlay pause window.",
  );

  const cursor = new OverlayController(page);

  await page.setViewportSize({ width: 1200, height: 900 });
  await cursor.inject();
  await gotoFixture(page, buildMovingClickFixture());
  await installOverlayObserver(page);

  const target = page.getByRole("button", { name: "Target", exact: true });
  await cursor.click(target);

  await expect(page.locator("body")).toHaveAttribute("data-clicked", "1");
  await expect(page.locator("body")).toHaveAttribute("data-click-target-moved", "1");

  const targetBox = await target.boundingBox();
  const overlay = await getOverlaySnapshot(page);

  expectOverlayAtCenter(overlay, targetBox);
  await expectRippleLifecycle(page, targetBox);
});

test("OverlayController.click does not emit a ripple when the target detaches before the real click", async ({
  page,
}) => {
  test.skip(
    !OVERLAY_ENABLED,
    "This regression specifically exercises the overlay pause window.",
  );

  const cursor = new OverlayController(page);

  await page.setViewportSize({ width: 1200, height: 900 });
  await cursor.inject();
  await gotoFixture(page, buildDetachingClickFixture());
  await installOverlayObserver(page);
  page.setDefaultTimeout(2_000);

  const target = page.getByRole("button", { name: "Target", exact: true });
  await expect(cursor.click(target)).rejects.toThrow();

  await expect(page.locator("body")).toHaveAttribute("data-clicked", "0");
  await expect(page.locator("body")).toHaveAttribute("data-click-target-detached", "1");
  await expect.poll(() => getRippleCount(page)).toBe(0);
  expect(
    (await getRippleEvents(page)).filter((event) => event.phase === "added"),
  ).toHaveLength(0);
});

test("clickWithOverlay self-heals injection when the overlay was never preloaded", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await gotoFixture(page, buildCursorFixture());
  await installOverlayObserver(page);

  await clickWithOverlay(
    page,
    page.getByRole("button", { name: "Target", exact: true }),
  );

  await expect(page.locator("body")).toHaveAttribute("data-clicked", "1");

  if (!OVERLAY_ENABLED) return;

  await expect.poll(async () => Boolean(await getOverlaySnapshot(page))).toBe(true);
  expect((await getOverlayPositions(page)).length).toBeGreaterThan(0);
});

test("legacy helpers preserve explicit seed positions and emit a ripple", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await injectCursorOverlay(page);
  await gotoFixture(
    page,
    buildCursorFixture({ targetLeft: 760, targetTop: 260 }),
  );
  await installOverlayObserver(page);

  await moveCursorOverlay(page, 100, 100);

  if (OVERLAY_ENABLED) {
    await expect.poll(() => getOverlaySnapshot(page)).toEqual({
      display: "block",
      left: "100px",
      top: "100px",
    });
    await clearOverlayPositions(page);
  }

  await clickWithOverlay(
    page,
    page.getByRole("button", { name: "Target", exact: true }),
  );

  await expect(page.locator("body")).toHaveAttribute("data-clicked", "1");

  if (!OVERLAY_ENABLED) return;

  const positions = await getOverlayPositions(page);
  const viewport = page.viewportSize();

  expect(positions.length).toBeGreaterThan(0);
  expect(
    positions.some(
      (position) =>
        position.left === `${(viewport?.width ?? 0) / 2}px` &&
        position.top === `${(viewport?.height ?? 0) / 2}px`,
    ),
  ).toBe(false);

  const targetBox = await page
    .getByRole("button", { name: "Target", exact: true })
    .boundingBox();
  await expectTrailLifecycle(page);
  await expectRippleLifecycle(page, targetBox);
});

test("moveCursorOverlay clears stale trail from the previous helper action", async ({
  page,
}) => {
  test.skip(
    !OVERLAY_ENABLED,
    "This regression specifically exercises overlay trail cleanup between helper calls.",
  );

  await page.setViewportSize({ width: 1100, height: 900 });
  await injectCursorOverlay(page);
  await gotoFixture(
    page,
    buildCursorFixture({ targetLeft: 760, targetTop: 260 }),
  );
  await installOverlayObserver(page);

  await clickWithOverlay(
    page,
    page.getByRole("button", { name: "Target", exact: true }),
  );
  expect(
    (await getTrailSnapshots(page)).some((snapshot) => snapshot.segmentCount > 0),
  ).toBe(true);

  await moveCursorOverlay(page, 50, 50);

  await expect.poll(() => getOverlaySnapshot(page)).toEqual({
    display: "block",
    left: "50px",
    top: "50px",
  });
  await expect.poll(() => getTrailSnapshot(page)).toEqual({
    display: "none",
    segmentCount: 0,
  });
});
