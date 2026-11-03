import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  outputDir: 'test-artifacts/playwright',
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium', colorScheme: 'light', reducedMotion: 'reduce', launchOptions: { args: ['--force-color-profile=srgb'] } },
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 30000 },
});
