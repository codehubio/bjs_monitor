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
    
    // Focus on the input first
    await searchInput.focus();
    
    // Type character by character with delay to simulate human typing
    await searchInput.pressSequentially(searchingSiteName, { delay: 500 });
    console.log(`Typed site name "${searchingSiteName}"`);

    // Trigger input and keyup events to ensure the application detects the input
    // Some applications rely on these events to trigger search/filter functionality
    await searchInput.dispatchEvent('input');
    await searchInput.dispatchEvent('keyup');
    await searchInput.dispatchEvent('keydown');
    await searchInput.dispatchEvent('change');
    
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

    // Wait for the first location list to disappear
    console.log('Waiting for first location list to disappear...');
    await locationList.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {
      // If it doesn't disappear, that's okay, continue
      console.log('First location list did not disappear, continuing...');
    });

    // Wait for a new ul list to appear after clicking the first item
    // The ul has many li, and one li (or its direct/indirect children) has the site name in the text
    console.log('Waiting for new location list to appear after clicking first item...');
    
    // Wait for a ul that contains an li with the site name
    const secondLocationList = page
      .locator('ul')
      .filter({ has: page.locator('li').filter({ hasText: searchingSiteName }) })
      .first();
    
    await secondLocationList.waitFor({ state: 'visible', timeout: 30000 });
    console.log('New location list appeared after clicking first item');

    // Find the li that contains the site name (either directly or in its children/descendants)
    // filter({ hasText: ... }) searches the element and all its descendants
    console.log(`Looking for li containing "${searchingSiteName}" in new location list...`);
    const secondListItem = secondLocationList
      .locator('li')
      .filter({ hasText: searchingSiteName })
      .first();
    
    await secondListItem.waitFor({ state: 'visible', timeout: 30000 });
    console.log(`Found li containing "${searchingSiteName}" in new location list`);
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

