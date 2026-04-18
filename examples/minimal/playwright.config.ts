import { overlayConfig } from "pw-cursor-overlay";

export default overlayConfig({
  testDir: ".",
  fullyParallel: true,
  reporter: "list",
  use: {
    viewport: { width: 1100, height: 900 },
  },
});
