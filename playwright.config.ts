import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './browser-tests',
  fullyParallel: false,
  // SwiftShader-backed browser suites are CPU-heavy on GitHub-hosted runners.
  // Keep local feedback parallel, but serialize CI to avoid cross-test browser
  // starvation that manifests as page.evaluate/screenshot/click timeouts.
  workers: process.env.CI ? 1 : 2,
  // One retry absorbs rare environmental browser-process deaths (swiftshader
  // CPU/memory contention right after the workspace build); assertions and
  // timeouts are unchanged, so real failures still surface on the retry.
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--use-angle=swiftshader'],
        },
      },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @web-three-city/terrain-lab preview --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
    },
    {
      command: 'pnpm --filter @web-three-city/game preview --host 127.0.0.1 --port 4174',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: false,
    },
  ],
});
