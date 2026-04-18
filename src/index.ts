// Public API.

export { overlayConfig } from "./config";
export { OverlayController } from "./controller";
export { injectCursorOverlay } from "./injection";
export { moveCursorOverlay } from "./animation";
export { clickWithOverlay, getOverlayController } from "./deprecated";
export type {
  CursorPosition,
  OverlayActionOptions,
  OverlayActionResult,
  ScrollDelta,
  SelectOptionDescriptor,
  SelectOptionValue,
} from "./types";
