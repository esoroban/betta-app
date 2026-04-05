import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "/tmp/betta-pw-results",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "off",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: true,
    timeout: 15000,
  },
});
