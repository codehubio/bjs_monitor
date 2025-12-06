import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import dotenv from 'dotenv';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './',
  /* Maximum time one test can run for. */
  timeout: 30 * 60 * 1000, // 30 minutes
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Run tests sequentially (one at a time) */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    headless: false,
    launchOptions: {
      args: ['--start-maximized'], // ensures OS-level window is maximized
    },
    viewport: null,

    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BJs_Web_Url || '',
    /* No viewport setting - let browser use native maximized size from --start-maximized */

    /* Grant location permissions */
    permissions: ['geolocation'],

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Take full page screenshots on test failure */
    screenshot: { mode: 'only-on-failure', fullPage: true },
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers - Chrome only */
  projects: [
    {
      name: 'chromium',
      use: {
        headless: false,
        viewport: null, // critical
        launchOptions: {
          args: ['--start-maximized'], // ensures OS-level window is maximized
        },
      },
    },
  ],
});

