// Static HTML fixtures used by the overlay regression suite. Each builder
// returns a self-contained document so tests can load via
// `page.goto("data:text/html,...")` — no dev server, no product code.

import type { Page } from "@playwright/test";

export async function gotoFixture(page: Page, html: string): Promise<void> {
  await page.goto(`data:text/html,${encodeURIComponent(html)}`);
}

export function buildCursorFixture(options?: {
  includeHoverTrap?: boolean;
  targetLeft?: number;
  targetTop?: number;
}): string {
  const targetLeft = options?.targetLeft ?? 780;
  const targetTop = options?.targetTop ?? 420;
  const hoverTrap = options?.includeHoverTrap
    ? `
      <div id="hover-trap">Hover trap</div>
      <script>
        window.__hoverTrapCount = 0;
        document.getElementById("hover-trap")?.addEventListener("mouseenter", () => {
          window.__hoverTrapCount += 1;
          document.body.setAttribute("data-hover-count", String(window.__hoverTrapCount));
        });
      </script>
    `
    : "";

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            margin: 0;
            min-height: 700px;
            position: relative;
            font-family: sans-serif;
          }

          #hover-trap {
            position: absolute;
            left: 580px;
            top: 250px;
            width: 120px;
            height: 160px;
            background: rgba(239, 68, 68, 0.12);
            border: 1px dashed rgba(239, 68, 68, 0.45);
          }

          #target {
            position: absolute;
            left: ${targetLeft}px;
            top: ${targetTop}px;
            width: 120px;
            height: 48px;
          }

          #answer-label,
          #difficulty-label {
            position: absolute;
            left: 720px;
            font-size: 13px;
          }

          #answer-label {
            top: 120px;
          }

          #answer {
            position: absolute;
            left: 720px;
            top: 146px;
            width: 220px;
            height: 42px;
            padding: 0 12px;
          }

          #hover-target {
            position: absolute;
            left: 790px;
            top: 280px;
            width: 140px;
            height: 52px;
          }

          #scroll-region {
            position: absolute;
            left: 720px;
            top: 500px;
            width: 220px;
            height: 120px;
            overflow: auto;
            border: 1px solid rgba(15, 23, 42, 0.16);
            background: rgba(248, 250, 252, 0.94);
          }

          #scroll-content {
            height: 540px;
            padding: 16px;
            background:
              linear-gradient(to bottom, rgba(224, 231, 255, 0.55), rgba(191, 219, 254, 0.2)),
              repeating-linear-gradient(
                to bottom,
                transparent,
                transparent 28px,
                rgba(148, 163, 184, 0.16) 28px,
                rgba(148, 163, 184, 0.16) 29px
              );
          }

          #difficulty-label {
            top: 658px;
          }

          #difficulty {
            position: absolute;
            left: 720px;
            top: 684px;
            width: 220px;
            height: 42px;
            padding: 0 12px;
          }
        </style>
      </head>
      <body
        data-clicked="0"
        data-hover-count="0"
        data-hover-target-count="0"
        data-select-value=""
      >
        ${hoverTrap}
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
          window.__hoverTargetCount = 0;
          document.getElementById("target")?.addEventListener("click", () => {
            document.body.setAttribute("data-clicked", "1");
          });

          document.getElementById("hover-target")?.addEventListener("mouseover", () => {
            window.__hoverTargetCount += 1;
            document.body.setAttribute(
              "data-hover-target-count",
              String(window.__hoverTargetCount),
            );
          });

          document.getElementById("difficulty")?.addEventListener("change", (event) => {
            document.body.setAttribute("data-select-value", event.target.value);
          });
        </script>
      </body>
    </html>
  `;
}

// A <select> that navigates away on change. Used to verify the controller
// survives page teardown during its label-cleanup finally block.
export function buildNavigatingSelectFixture(): string {
  return `
    <!doctype html>
    <html lang="en">
      <body>
        <label for="nav-select">Navigate</label>
        <select
          id="nav-select"
          onchange="window.location.href='about:blank?done=1'"
        >
          <option value="stay">Stay</option>
          <option value="go">Go</option>
        </select>
      </body>
    </html>
  `;
}

// A hover target that jumps to a new position the moment the "Hovering..."
// label becomes visible — forces the controller to re-resolve the bounding
// box after the label-and-pause window.
export function buildMovingHoverFixture(): string {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            margin: 0;
            min-height: 760px;
            position: relative;
            font-family: sans-serif;
          }

          #hover-target {
            position: absolute;
            left: 680px;
            top: 220px;
            width: 140px;
            height: 52px;
          }
        </style>
      </head>
      <body data-hover-target-count="0" data-hover-target-moved="0">
        <button id="hover-target" type="button">Hover target</button>
        <script>
          const hoverTarget = document.getElementById("hover-target");
          hoverTarget?.addEventListener("mouseenter", () => {
            const nextCount =
              Number(document.body.getAttribute("data-hover-target-count") ?? "0") + 1;
            document.body.setAttribute("data-hover-target-count", String(nextCount));
          });

          function moveTargetWhenBubbleAppears() {
            if (document.body.getAttribute("data-hover-target-moved") === "1") {
              return;
            }

            const label = document.getElementById("__pw_cursor_label");
            if (!(label instanceof HTMLElement)) {
              return;
            }

            if (label.style.display !== "block" || label.textContent !== "Hovering...") {
              return;
            }

            if (!(hoverTarget instanceof HTMLElement)) {
              return;
            }

            hoverTarget.style.left = "860px";
            hoverTarget.style.top = "340px";
            document.body.setAttribute("data-hover-target-moved", "1");
          }

          moveTargetWhenBubbleAppears();
          new MutationObserver(() => {
            moveTargetWhenBubbleAppears();
          }).observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
          });
        </script>
      </body>
    </html>
  `;
}

// A click target that jumps the moment the overlay cursor arrives at the
// first bounding-box centre — verifies the ripple lands on the final
// position, not the stale one.
export function buildMovingClickFixture(): string {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            margin: 0;
            min-height: 760px;
            position: relative;
            font-family: sans-serif;
          }

          #target {
            position: absolute;
            left: 680px;
            top: 220px;
            width: 140px;
            height: 52px;
          }
        </style>
      </head>
      <body data-clicked="0" data-click-target-moved="0">
        <button id="target" type="button">Target</button>
        <script>
          const target = document.getElementById("target");
          target?.addEventListener("click", () => {
            document.body.setAttribute("data-clicked", "1");
          });

          function moveTargetWhenCursorArrives() {
            if (document.body.getAttribute("data-click-target-moved") === "1") {
              return;
            }

            const cursor = document.getElementById("__pw_cursor");
            if (!(cursor instanceof HTMLElement)) {
              return;
            }

            if (cursor.style.display !== "block") {
              return;
            }

            if (cursor.style.left !== "750px" || cursor.style.top !== "246px") {
              return;
            }

            if (!(target instanceof HTMLElement)) {
              return;
            }

            target.style.left = "860px";
            target.style.top = "340px";
            document.body.setAttribute("data-click-target-moved", "1");
          }

          moveTargetWhenCursorArrives();
          new MutationObserver(() => {
            moveTargetWhenCursorArrives();
          }).observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
          });
        </script>
      </body>
    </html>
  `;
}

// A click target that detaches from the DOM the moment the cursor arrives.
// Used to assert the controller does NOT emit a ripple when the real click
// throws because the target is gone.
export function buildDetachingClickFixture(): string {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            margin: 0;
            min-height: 760px;
            position: relative;
            font-family: sans-serif;
          }

          #target {
            position: absolute;
            left: 680px;
            top: 220px;
            width: 140px;
            height: 52px;
          }
        </style>
      </head>
      <body data-clicked="0" data-click-target-detached="0">
        <button id="target" type="button">Target</button>
        <script>
          const target = document.getElementById("target");
          target?.addEventListener("click", () => {
            document.body.setAttribute("data-clicked", "1");
          });

          function detachTargetWhenCursorArrives() {
            if (document.body.getAttribute("data-click-target-detached") === "1") {
              return;
            }

            const cursor = document.getElementById("__pw_cursor");
            if (!(cursor instanceof HTMLElement)) {
              return;
            }

            if (cursor.style.display !== "block") {
              return;
            }

            if (cursor.style.left !== "750px" || cursor.style.top !== "246px") {
              return;
            }

            target?.remove();
            document.body.setAttribute("data-click-target-detached", "1");
          }

          detachTargetWhenCursorArrives();
          new MutationObserver(() => {
            detachTargetWhenCursorArrives();
          }).observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
          });
        </script>
      </body>
    </html>
  `;
}
