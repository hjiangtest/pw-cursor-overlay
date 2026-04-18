# pw-cursor-overlay

> Visible cursor / trail / ripple overlay for Playwright — **zero-cost in CI**,
> **agent-friendly in local debug**.

A lightweight overlay layer for Playwright that renders a visible cursor dot,
a fading motion trail, a click ripple, and short action-label bubbles (e.g.
`Typing…`, `Hovering…`) so that test recordings and traces are human-readable
— especially useful for reviewing agent-generated Playwright scripts.

The overlay is **purely visual**: all overlay elements are
`pointer-events: none`, and Playwright still drives real clicks, fills, and
hovers through the normal `Locator` APIs. Action semantics are unchanged.

---

## Status

**🚧 Scaffolding in progress.** This repository was extracted from
[`hjiangcpp/ai-lite-demo`](https://github.com/hjiangcpp/ai-lite-demo)'s
`tests/e2e/support/debugCursor.ts`. The source is being landed in a series of
small, reviewable PRs. See issues / PRs for current progress.

Once the initial extraction is complete, full installation instructions, API
reference, and FAQ will live here.

---

## License

MIT © Huanhuan Jiang — see [LICENSE](./LICENSE).
