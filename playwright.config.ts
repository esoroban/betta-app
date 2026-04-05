import { defineConfig } from "@playwright/test";

const isExternal = process.env.PLAYWRIGHT_USE_EXTERNAL_URL === "1";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "/tmp/betta-pw-results",
  fullyParallel: false,
  retries: isExternal ? 1 : 0,
  workers: 1,
  reporter: "list",
  timeout: isExternal ? 60_000 : 30_000,
  expect: {
    timeout: isExternal ? 15_000 : 5_000,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: isExternal ? "on-first-retry" : "off",
    actionTimeout: isExternal ? 15_000 : 10_000,
    navigationTimeout: isExternal ? 30_000 : 15_000,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  ...(isExternal
    ? {}
    : {
        webServer: {
          command: "npm run dev",
          port: 3000,
          reuseExistingServer: true,
          timeout: 15_000,
        },
      }),
});
