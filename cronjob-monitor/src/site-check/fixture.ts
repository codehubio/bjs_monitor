import { Page } from '@playwright/test';
import { config } from '../config';

/**
 * Build the find location URL from configuration
 * @returns The complete find location URL
 */
export function buildFindLocationUrl(): string {
  const baseUrl = config.bjsWebUrl.replace(/\/$/, ''); // Remove trailing slash if present
  const findLocationPath = config.bjsFindLocationPath.replace(/^\//, ''); // Remove leading slash if present
  return `${baseUrl}/${findLocationPath}`;
}

/**
 * Navigate to find location page and enter search text
 * @param page Playwright page object
 * @param searchingSiteName Optional site name to search for
 * @param locationId Optional location ID to select (from locationParsed.id)
 */
export async function waitForFindLocationPageAndSearchInput(
  page: Page,
  searchingSiteName?: string,
  locationId?: string
): Promise<void> {
  // Navigate directly to the find location page
  const findLocationUrl = buildFindLocationUrl();
  console.log(`Navigating to find location URL: ${findLocationUrl}`);
  await page.goto(findLocationUrl);

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

    // Find and select the li with id matching locationParsed.id
    if (locationId) {
      console.log(`Looking for li with id="${locationId}" in new location list...`);
      const secondListItem = secondLocationList
        .locator(`li[id="${locationId}"]`)
        .first();
      
      await secondListItem.waitFor({ state: 'visible', timeout: 30000 });
      console.log(`Found li with id="${locationId}" in new location list`);
      
      // Click the li item that matches the location ID
      console.log(`Clicking li item with id="${locationId}"...`);
      await secondListItem.click();
      console.log(`Clicked li item with id="${locationId}"`);
    }
    
    // Click on the button that has direct/indirect children with text "Choose location"
    console.log('Looking for button with "Choose location" text...');
    const chooseLocationButton = page
      .locator('button')
      .filter({ hasText: /choose location/i })
      .first();
    
    await chooseLocationButton.waitFor({ state: 'visible', timeout: 30000 });
    console.log('Found button with "Choose location" text');
    
    console.log('Clicking "Choose location" button...');
    await chooseLocationButton.click();
    console.log('Clicked "Choose location" button');
  }
}

/**
 * Complete flow: Navigate to find location page and enter search text
 * @param page Playwright page object
 * @param searchingSiteName Optional site name to search for in the search input
 * @param locationId Optional location ID to select (from locationParsed.id)
 */
export async function navigateToFindLocationPage(
  page: Page,
  searchingSiteName?: string,
  locationId?: string
): Promise<void> {
  await waitForFindLocationPageAndSearchInput(page, searchingSiteName, locationId);
}

