import type { PlaywrightTestConfig } from "@playwright/test";

/**
 * Wraps a Playwright config and layers in cursor-overlay-friendly debug
 * settings driven by two env switches:
 *
 *   PW_LIVE_DEBUG=1  → headed browser + slowMo + video recording
 *   PW_TRACE=1       → capture full trace on every run (overrides the
 *                      default "on-first-retry", which is a no-op when
 *                      retries are disabled)
 *
 * When neither env var is set, the returned config is identical to the
 * input — no overhead in CI.
 *
 * Example:
 * ```ts
 * import { defineConfig } from "@playwright/test";
 * import { overlayConfig } from "pw-cursor-overlay";
 *
 * export default overlayConfig(defineConfig({
 *   testDir: "./tests",
 *   use: { baseURL: "http://localhost:3000" },
 * }));
 * ```
 */
export function overlayConfig(base: PlaywrightTestConfig): PlaywrightTestConfig {
  const liveDebug = process.env.PW_LIVE_DEBUG === "1";
  const traceOn = process.env.PW_TRACE === "1";

  if (!liveDebug && !traceOn) {
    return base;
  }

  const baseUse = base.use ?? {};
  const baseLaunchOptions =
    (baseUse as { launchOptions?: Record<string, unknown> }).launchOptions ?? {};

  return {
    ...base,
    use: {
      ...baseUse,
      headless: liveDebug ? false : baseUse.headless,
      launchOptions: {
        ...baseLaunchOptions,
        slowMo: liveDebug ? 500 : (baseLaunchOptions as { slowMo?: number }).slowMo,
      },
      video: liveDebug ? "on" : baseUse.video,
      trace: traceOn ? "on" : baseUse.trace,
    },
  };
}
