// Helpers for telling apart "page is mid-navigation / already closed" errors
// (which we treat as best-effort and ignore) from genuine evaluate bugs
// (which we re-throw so they surface).

// Substrings (lowercased) of Playwright errors that mean "page is
// mid-navigation or already gone" — safe to ignore on a best-effort evaluate
// before goto or during teardown. Verified against Playwright 1.58.x actual
// error messages.
export const EXPECTED_EVALUATE_ERRORS: readonly string[] = [
  "has been closed", // "Target page, context or browser has been closed"
  "frame was detached", // "Frame was detached"
  "execution context was destroyed",
  "navigation",
];

export function isExpectedEvaluateError(err: Error): boolean {
  const msg = (err?.message ?? "").toLowerCase();
  return EXPECTED_EVALUATE_ERRORS.some((substring) => msg.includes(substring));
}

export function rethrowUnexpectedEvaluateError(err: Error): void {
  if (!isExpectedEvaluateError(err)) {
    throw err;
  }
}
