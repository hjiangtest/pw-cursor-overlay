import { defineConfig } from "@playwright/test";

// Subsequent PRs wrap this with `overlayConfig()` from src/config once that
// module lands.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: 0,
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
