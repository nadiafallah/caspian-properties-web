import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/**
 * E2E tests run against a production build that uses the in-memory lead store and a
 * stubbed Cal.com embed (tests/e2e/cal-embed-stub.js). They never touch real bookings,
 * Google Sheets or client data.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: {
      LEAD_STORE: "memory",
      ALLOW_MEMORY_STORE: "true",
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
      NEXT_PUBLIC_CALCOM_LINK: "e2e-test/private-consultation",
      NEXT_PUBLIC_CALCOM_NAMESPACE: "e2e",
    },
  },
});
