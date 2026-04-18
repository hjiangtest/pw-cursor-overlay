// Public API. Core action runtime (`OverlayController`, injection, deprecated
// compat helpers) lands in PRs 3 – 5.

export { overlayConfig } from "./config";
export { injectCursorOverlay } from "./injection";
export type {
  CursorPosition,
  OverlayActionOptions,
  OverlayActionResult,
  ScrollDelta,
  SelectOptionDescriptor,
  SelectOptionValue,
} from "./types";
