import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const port = process.env.TEST_PORT ?? '3012';
const baseURL = `http://127.0.0.1:${port}`;
const dataDir = mkdtempSync(path.join(tmpdir(), 'travelmemo-e2e-'));
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    launchOptions: {
      channel: 'chrome',
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
  webServer: {
    command: 'node server/index.js',
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    env: {
      PORT: port, DATA_DIR: dataDir, STATIC_DIR: process.env.TEST_STATIC_DIR ?? path.resolve('web/dist'),
      ADMIN_USERNAME: 'e2e-admin', ADMIN_PASSWORD: 'e2e-only-password-2026',
      COOKIE_SECURE: 'false', TRUST_PROXY: 'false',
    },
  },
});
