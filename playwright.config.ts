import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:4180" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npx vite preview --port 4180 --strictPort",
    url: "http://localhost:4180",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
