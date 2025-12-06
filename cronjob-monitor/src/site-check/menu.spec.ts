import { test, expect } from '@playwright/test';
import { config } from '../config';
import { navigateToFindLocationPage, buildMenuUrl } from './fixture';

test.describe('BJs Menu Page', () => {
  test('should visit the menu page', async ({ page }) => {
    // Navigate to menu, click Change Location, and wait for find-location page
    await navigateToFindLocationPage(page);

    // Take a screenshot
    await page.screenshot({ path: 'menu-page.png', fullPage: true });

    // Verify page loaded successfully
    const baseUrl = config.bjsWebUrl.replace(/\/$/, '');
    expect(page.url()).toContain(baseUrl);
  });
});

