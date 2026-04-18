// Regression tests for OverlayController.fill / hover / scroll / select.
// Click tests live in tests/click.spec.ts — this file covers the four
// non-click interaction flows that share the same label-bubble lifecycle
// but otherwise diverge in how they resolve the final cursor position.

import { expect, test } from "@playwright/test";

import { OverlayController } from "../src";
import {
  buildCursorFixture,
  buildMovingHoverFixture,
  buildNavigatingSelectFixture,
  gotoFixture,
} from "./support/fixtures";
import {
  expectLabelBubbleLifecycle,
  expectOverlayAtCenter,
  getOverlaySnapshot,
  installOverlayObserver,
} from "./support/observer";

const OVERLAY_ENABLED =
  process.env.PW_LIVE_DEBUG === "1" || process.env.PW_TRACE === "1";

test("OverlayController.fill shows and hides the typing bubble", async ({
  page,
}) => {
  const cursor = new OverlayController(page);

  await page.setViewportSize({ width: 1100, height: 900 });
  await cursor.inject();
  await gotoFixture(page, buildCursorFixture());
  await installOverlayObserver(page);

  const input = page.getByLabel("Answer");
  await cursor.fill(input, "Overlay typing");

  await expect(input).toHaveValue("Overlay typing");

  if (!OVERLAY_ENABLED) return;

  await expect.poll(async () => Boolean(await getOverlaySnapshot(page))).toBe(true);

  const inputBox = await input.boundingBox();
  const overlay = await getOverlaySnapshot(page);
  const label = await expectLabelBubbleLifecycle(page, "Typing...");

  expect(overlay?.display).toBe("block");
  expectOverlayAtCenter(overlay, inputBox);
  expectOverlayAtCenter(label, inputBox);
});

test("OverlayController.select tolerates navigation during label cleanup", async ({
  page,
}) => {
  const cursor = new OverlayController(page);

  await page.setViewportSize({ width: 1100, height: 900 });
  await cursor.inject();
  await gotoFixture(page, buildNavigatingSelectFixture());

  await cursor.select(page.locator("#nav-select"), "go");

  await expect(page).toHaveURL(/about:blank\?done=1$/);
});

test("OverlayController.hover keeps path side effects off and toggles the bubble", async ({
  page,
}) => {
  const cursor = new OverlayController(page);

  await page.setViewportSize({ width: 1100, height: 900 });
  await cursor.inject();
  await gotoFixture(page, buildCursorFixture({ includeHoverTrap: true }));
  await installOverlayObserver(page);

  const hoverTarget = page.getByRole("button", { name: "Hover target" });
  await cursor.hover(hoverTarget);

  await expect(page.locator("body")).toHaveAttribute("data-hover-count", "0");
  await expect
    .poll(() => hoverTarget.evaluate((element) => element.matches(":hover")))
    .toBe(true);

  if (!OVERLAY_ENABLED) return;

  const hoverTargetBox = await hoverTarget.boundingBox();
  const overlay = await getOverlaySnapshot(page);
  const label = await expectLabelBubbleLifecycle(page, "Hovering...");

  expectOverlayAtCenter(overlay, hoverTargetBox);
  expectOverlayAtCenter(label, hoverTargetBox);
});

test("OverlayController.hover re-resolves moving targets before the real hover", async ({
  page,
}) => {
  test.skip(
    !OVERLAY_ENABLED,
    "This regression specifically exercises the overlay pause window.",
  );

  const cursor = new OverlayController(page);

  await page.setViewportSize({ width: 1200, height: 900 });
  await cursor.inject();
  await gotoFixture(page, buildMovingHoverFixture());
  await installOverlayObserver(page);

  const hoverTarget = page.getByRole("button", { name: "Hover target" });
  await cursor.hover(hoverTarget);

  await expect(page.locator("body")).toHaveAttribute(
    "data-hover-target-moved",
    "1",
  );
  await expect(page.locator("body")).toHaveAttribute(
    "data-hover-target-count",
    "1",
  );
  await expect
    .poll(() => hoverTarget.evaluate((element) => element.matches(":hover")))
    .toBe(true);

  const hoverTargetBox = await hoverTarget.boundingBox();
  const overlay = await getOverlaySnapshot(page);
  const label = await expectLabelBubbleLifecycle(page, "Hovering...");

  expectOverlayAtCenter(overlay, hoverTargetBox);
  expectOverlayAtCenter(label, hoverTargetBox);
});

test("OverlayController.scroll shows the scrolling bubble", async ({ page }) => {
  const cursor = new OverlayController(page);

  await page.setViewportSize({ width: 1100, height: 900 });
  await cursor.inject();
  await gotoFixture(page, buildCursorFixture());
  await installOverlayObserver(page);

  const scrollRegion = page.locator("#scroll-region");
  await cursor.scroll(scrollRegion, 180);

  await expect
    .poll(() =>
      scrollRegion.evaluate((element) =>
        element instanceof HTMLElement ? element.scrollTop : 0,
      ),
    )
    .toBe(180);

  if (!OVERLAY_ENABLED) return;

  const regionBox = await scrollRegion.boundingBox();
  const overlay = await getOverlaySnapshot(page);
  const label = await expectLabelBubbleLifecycle(page, "Scrolling...");

  expectOverlayAtCenter(overlay, regionBox);
  expectOverlayAtCenter(label, regionBox);
});

test("OverlayController.select shows the selecting bubble", async ({ page }) => {
  const cursor = new OverlayController(page);

  await page.setViewportSize({ width: 1100, height: 900 });
  await cursor.inject();
  await gotoFixture(page, buildCursorFixture());
  await installOverlayObserver(page);

  const select = page.getByLabel("Difficulty");
  await cursor.select(select, "hard");

  await expect(select).toHaveValue("hard");
  await expect(page.locator("body")).toHaveAttribute(
    "data-select-value",
    "hard",
  );

  if (!OVERLAY_ENABLED) return;

  const selectBox = await select.boundingBox();
  const overlay = await getOverlaySnapshot(page);
  const label = await expectLabelBubbleLifecycle(page, "Selecting...");

  expectOverlayAtCenter(overlay, selectBox);
  expectOverlayAtCenter(label, selectBox);
});
