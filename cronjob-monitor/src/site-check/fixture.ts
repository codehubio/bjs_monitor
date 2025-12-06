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
 * @param searchingSiteName Optional site name to search for
 */
export async function waitForFindLocationPageAndSearchInput(
  page: Page,
  searchingSiteName?: string
): Promise<void> {
  // Wait for page to redirect to /find-location
  console.log('Waiting for redirect to /find-location page...');
  await page.waitForURL('**/find-location**', { timeout: 30000 });
  console.log('Page redirected to /find-location');

  // Wait for the search input to appear
  console.log('Waiting for search input to appear...');
  const searchInput = page.getByTestId('search-input');
  await searchInput.waitFor({ state: 'visible', timeout: 30000 });
  console.log('Search input appeared');

  // If site name is provided, type it into the search input
  if (searchingSiteName) {
    console.log(`Typing site name "${searchingSiteName}" into search input (human-like)...`);
    // Type character by character with delay to simulate human typing
    await searchInput.pressSequentially(searchingSiteName, { delay: 100 });
    console.log(`Typed site name "${searchingSiteName}"`);

    // Wait for the location list (ul) to appear
    // The ul has many li, each li contains a button with text containing the site name
    console.log('Waiting for location list to appear...');
    const locationList = page.locator('ul').first();
    await locationList.waitFor({ state: 'visible', timeout: 30000 });
    console.log('Location list appeared');

    // Find the button within li that contains the site name
    console.log(`Looking for button containing "${searchingSiteName}" in location list...`);
    const locationButton = locationList
      .locator('li')
      .locator('button')
      .filter({ hasText: searchingSiteName })
      .first();
    
    await locationButton.waitFor({ state: 'visible', timeout: 30000 });
    console.log(`Found button containing "${searchingSiteName}"`);

    // Click the button
    console.log('Clicking the location button...');
    await locationButton.click();
    console.log('Clicked the location button');

    // Wait for another ul to appear with li tags containing child elements with the site name
    console.log('Waiting for second location list to appear...');
    const secondLocationList = page.locator('ul').nth(1);
    await secondLocationList.waitFor({ state: 'visible', timeout: 30000 });
    console.log('Second location list appeared');

    // Wait for list items in the second list that contain the site name
    const secondListItems = secondLocationList.locator('li').filter({ hasText: searchingSiteName });
    await secondListItems.first().waitFor({ state: 'visible', timeout: 30000 });
    console.log(`Found location items containing "${searchingSiteName}"`);
  }
}

/**
 * Complete flow: Navigate to menu, click Change Location, and wait for find-location page
 * @param page Playwright page object
 * @param searchingSiteName Optional site name to search for in the search input
 */
export async function navigateToFindLocationPage(
  page: Page,
  searchingSiteName?: string
): Promise<void> {
  await navigateToMenuAndClickChangeLocation(page);
  await waitAndClickChangeLocationButton(page);
  await waitForFindLocationPageAndSearchInput(page, searchingSiteName);
}

