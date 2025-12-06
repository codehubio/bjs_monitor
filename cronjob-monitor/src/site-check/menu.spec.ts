import { test, expect } from '@playwright/test';
import { config } from '../config';

test.describe('BJs Menu Page', () => {
  test('should visit the menu page', async ({ page }) => {
    // Build the menu URL
    const baseUrl = config.bjsWebUrl.replace(/\/$/, ''); // Remove trailing slash if present
    const menuPath = config.bjsMenuPath.replace(/^\//, ''); // Remove leading slash if present
    const menuUrl = `${baseUrl}/${menuPath}`;

    console.log(`Visiting menu URL: ${menuUrl}`);

    // Navigate to the menu page
    await page.goto(menuUrl);

    // Wait for page to load

    // Wait for and click the "Change Location" button
    // The button has a child element with text "change location" (case-insensitive)
    console.log('Waiting for "Change Location" button to appear...');
    const changeLocationButton = page.locator('button').filter({ hasText: /change location/i });
    
    // Wait for the button to be visible and attached to the DOM
    await changeLocationButton.waitFor({ 
      state: 'visible', 
      timeout: 30000 
    }); 
    
    console.log('"Change Location" button appeared, clicking...');
    await changeLocationButton.click();
    console.log('Clicked "Change Location" button');

    // Wait a bit for any location selection UI to appear
    await page.waitForTimeout(1000);

    // Take a screenshot
    await page.screenshot({ path: 'menu-page.png', fullPage: true });

    // Verify page loaded successfully
    expect(page.url()).toContain(baseUrl);
  });
});

