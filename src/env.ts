// Overlay is active when either live-debug or trace mode is requested. When
// neither env var is set, every overlay helper short-circuits to the plain
// Playwright locator call — zero runtime cost in CI.
export const OVERLAY_ENABLED =
  process.env.PW_LIVE_DEBUG === "1" || process.env.PW_TRACE === "1";

// Video recording needs a longer pause so frames are captured.
// Trace mode already records action snapshots, so a shorter pause is enough.
export const OVERLAY_PAUSE_MS = process.env.PW_LIVE_DEBUG === "1" ? 600 : 150;
export const OVERLAY_MOVE_MS = process.env.PW_LIVE_DEBUG === "1" ? 180 : 120;
export const OVERLAY_LABEL_FADE_MS = 140;
export const TRAIL_FADE_MS = process.env.PW_LIVE_DEBUG === "1" ? 260 : 180;
export const TRAIL_MAX_POINTS = 10;
export const TRAIL_SAMPLE_DISTANCE_PX = 8;
export const RIPPLE_ANIMATION_MS =
  process.env.PW_LIVE_DEBUG === "1" ? 520 : 420;
export const RIPPLE_CLEANUP_BUFFER_MS = 160;
export const OVERLAY_MOVE_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
export const OVERLAY_FADE_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";

// DOM IDs / attributes used by the injected script. Exported so tests and
// consumers can filter them out of page snapshots if desired.
export const OVERLAY_STYLE_ELEMENT_ID = "__pw_cursor_overlay_styles";
export const TRAIL_ELEMENT_ID = "__pw_cursor_trail";
export const CURSOR_ELEMENT_ID = "__pw_cursor";
export const LABEL_ELEMENT_ID = "__pw_cursor_label";
export const RIPPLE_CLASS_NAME = "__pw_cursor_ripple";
export const RIPPLE_DATA_ATTRIBUTE = "data-pw-cursor-ripple";
export const TRAIL_SEGMENT_DATA_ATTRIBUTE = "data-pw-cursor-trail-segment";

export const DEFAULT_ACTION_LABELS = {
  fill: "Typing...",
  hover: "Hovering...",
  scroll: "Scrolling...",
  select: "Selecting...",
} as const;

export function getCursorTransition(durationMs: number): string {
  return `left ${durationMs}ms ${OVERLAY_MOVE_EASING},top ${durationMs}ms ${OVERLAY_MOVE_EASING}`;
}

export function getLabelTransition(durationMs: number): string {
  return `${getCursorTransition(durationMs)},opacity ${OVERLAY_LABEL_FADE_MS}ms ${OVERLAY_FADE_EASING}`;
}
