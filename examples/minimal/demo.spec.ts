// Minimal OverlayController demo — one spec, one page, five overlay actions.
//
// Run with:
//   npx playwright test                   # overlay off, CI-style
//   PW_LIVE_DEBUG=1 playwright test --headed   # overlay on, video-tuned
//   PW_TRACE=1     playwright test --trace on  # overlay on, trace-tuned
//
// See ./README.md for how to point this at a real app.

import { expect, test as base } from "@playwright/test";
import { OverlayController } from "pw-cursor-overlay";

// Pattern we recommend in real projects: hold the OverlayController in a
// Playwright fixture so every test receives a pre-injected `cursor`.
const test = base.extend<{ cursor: OverlayController }>({
  cursor: async ({ page }, use) => {
    const cursor = new OverlayController(page);
    await cursor.inject();
    await use(cursor);
  },
});

const DEMO_FIXTURE = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <style>
        body { margin: 0; min-height: 700px; position: relative;
               font-family: sans-serif; }
        label { position: absolute; left: 720px; font-size: 13px; }
        input, select { position: absolute; left: 720px; width: 220px;
                        height: 42px; padding: 0 12px; }
        button { position: absolute; }
        #answer-label { top: 120px; }
        #answer       { top: 146px; }
        #hover-target { left: 790px; top: 280px; width: 140px; height: 52px; }
        #scroll-region {
          position: absolute; left: 720px; top: 340px;
          width: 220px; height: 120px; overflow: auto;
          border: 1px solid rgba(15, 23, 42, 0.16);
        }
        #scroll-content { height: 540px; padding: 16px;
                          background: linear-gradient(to bottom, #e0e7ff, #bfdbfe); }
        #difficulty-label { top: 490px; }
        #difficulty       { top: 516px; }
        #target { left: 780px; top: 600px; width: 120px; height: 48px; }
      </style>
    </head>
    <body data-clicked="0" data-select-value="">
      <label id="answer-label" for="answer">Answer</label>
      <input id="answer" type="text" />
      <button id="hover-target" type="button">Hover target</button>
      <div id="scroll-region">
        <div id="scroll-content">Scrollable content</div>
      </div>
      <label id="difficulty-label" for="difficulty">Difficulty</label>
      <select id="difficulty">
        <option value="easy">Easy</option>
        <option value="medium">Medium</option>
        <option value="hard">Hard</option>
      </select>
      <button id="target" type="button">Target</button>
      <script>
        document.getElementById("target")?.addEventListener("click", () => {
          document.body.setAttribute("data-clicked", "1");
        });
        document.getElementById("difficulty")?.addEventListener("change", (event) => {
          document.body.setAttribute("data-select-value", event.target.value);
        });
      </script>
    </body>
  </html>
`;

test.beforeEach(async ({ page }) => {
  await page.goto(`data:text/html,${encodeURIComponent(DEMO_FIXTURE)}`);
});

test("click, fill, hover, scroll, select", async ({ page, cursor }) => {
  // fill — overlay labels the input with "Typing..."
  await cursor.fill(page.getByLabel("Answer"), "Overlay typing");
  await expect(page.getByLabel("Answer")).toHaveValue("Overlay typing");

  // hover — overlay labels the button with "Hovering..."
  await cursor.hover(page.getByRole("button", { name: "Hover target" }));
  await expect
    .poll(() =>
      page
        .getByRole("button", { name: "Hover target" })
        .evaluate((element) => element.matches(":hover")),
    )
    .toBe(true);

  // scroll — overlay labels the region with "Scrolling..."
  const scrollRegion = page.locator("#scroll-region");
  await cursor.scroll(scrollRegion, 180);
  await expect
    .poll(() =>
      scrollRegion.evaluate((element) =>
        element instanceof HTMLElement ? element.scrollTop : 0,
      ),
    )
    .toBe(180);

  // select — overlay labels the <select> with "Selecting..."
  await cursor.select(page.getByLabel("Difficulty"), "hard");
  await expect(page.getByLabel("Difficulty")).toHaveValue("hard");

  // click — overlay fires a ripple at the target's centre
  await cursor.click(page.getByRole("button", { name: "Target", exact: true }));
  await expect(page.locator("body")).toHaveAttribute("data-clicked", "1");
});
