import { Page } from '@playwright/test';
import { config } from '../config';

/**
 * Build the menu URL from configuration
 * @returns The complete menu URL
 */
export function buildMenuUrl(): string {
  const baseUrl = config.bjsWebUrl.replace(/\/$/, ''); // Remove trailing slash if present
  const menuPath = config.bjsMenuPath.replace(/^\//, ''); // Remove leading slash if present
  return `${baseUrl}/${menuPath}`;
}

/**
 * Navigate to the menu page and click "Change Location" button
 * @param page Playwright page object
 */
export async function navigateToMenuAndClickChangeLocation(page: Page): Promise<void> {
  const menuUrl = buildMenuUrl();
  console.log(`Visiting menu URL: ${menuUrl}`);

  // Navigate to the menu page
  await page.goto(menuUrl);
}

/**
 * Wait for and click the "Change Location" button
 * The button has a child element with text "change location" (case-insensitive)
 * @param page Playwright page object
 */
export async function waitAndClickChangeLocationButton(page: Page): Promise<void> {
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
}

/**
 * Wait for page to redirect to /find-location and wait for search input to appear
 * @param page Playwright page object
 */
export async function waitForFindLocationPageAndSearchInput(page: Page): Promise<void> {
  // Wait for page to redirect to /find-location
  console.log('Waiting for redirect to /find-location page...');
  await page.waitForURL('**/find-location**', { timeout: 30000 });
  console.log('Page redirected to /find-location');

  // Wait for the search input to appear
  console.log('Waiting for search input to appear...');
  const searchInput = page.getByTestId('search-input');
  await searchInput.waitFor({ state: 'visible', timeout: 30000 });
  console.log('Search input appeared');
}

/**
 * Complete flow: Navigate to menu, click Change Location, and wait for find-location page
 * @param page Playwright page object
 */
export async function navigateToFindLocationPage(page: Page): Promise<void> {
  await navigateToMenuAndClickChangeLocation(page);
  await waitAndClickChangeLocationButton(page);
  await waitForFindLocationPageAndSearchInput(page);
}

