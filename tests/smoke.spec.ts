import { expect, test } from "@playwright/test";

// Placeholder so `playwright test` finds at least one spec. Real overlay
// regression tests land in later PRs.
test("smoke: playwright harness is wired up", async ({ page }) => {
  expect(page).toBeTruthy();
});
