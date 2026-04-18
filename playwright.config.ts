import { defineConfig } from "@playwright/test";
import { overlayConfig } from "./src/config";

export default overlayConfig(
  defineConfig({
    testDir: "./tests",
    fullyParallel: false,
    retries: 0,
    projects: [
      {
        name: "chromium",
        use: { browserName: "chromium" },
      },
    ],
  }),
);
