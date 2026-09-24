import { defineConfig, devices } from '@playwright/test';

// Locally a pre-installed Chromium can be used via PW_CHROMIUM_PATH; CI runs
// `npx playwright install --with-deps` and tests Chromium, Firefox and WebKit.
const chromiumPath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: 'tests/browser',
  timeout: 180_000,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4174' },
  webServer: [
    {
      command: 'npm run build && npx vite preview apps/game --port 4174 --strictPort',
      url: 'http://localhost:4174',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run build -w @pixel-horde/admin && npx vite preview apps/admin --port 4175 --strictPort',
      url: 'http://localhost:4175',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: chromiumPath ? { executablePath: chromiumPath } : {} } },
    ...(chromiumPath ? [] : [
      { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
      { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    ]),
  ],
});
