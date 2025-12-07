import { Page } from '@playwright/test';
import { config } from '../config';

/**
 * Mapping of order type to display text
 */
export const ORDER_TYPE_TEXT_MAP: Record<'takeout' | 'delivery' | 'dinein', string> = {
  takeout: 'Takeout',
  delivery: 'Delivery',
  dinein: 'Dine-In'
};

/**
 * Handle takeout order type UI flow
 * @param page Playwright page object
 */
export async function handleTakeoutOrderType(page: Page): Promise<void> {
  // TODO: Implement takeout-specific UI handling
  // Wait for the "Start my order" button to appear and React state to update
  console.log('Waiting for button with text "Start my order"...');
  
  // Wait for the button to be attached to the DOM
  const startOrderButton = page
    .locator('button')
    .filter({ has: page.getByText(/start my order/i) })
    .first();
  
  await startOrderButton.waitFor({ state: 'attached', timeout: 30000 });
  console.log('Button found in DOM, waiting for React state to update...');
  
  // Wait a bit for React state to update
  await page.waitForTimeout(3000);
  
  // Try clicking via JavaScript to bypass Playwright's actionability checks
  console.log('Attempting to click button via JavaScript...');
  await startOrderButton.evaluate((button: any) => {
    button.click();
  });
  console.log('Clicked "Start my order" button via JavaScript');
}

/**
 * Handle delivery order type UI flow
 * @param page Playwright page object
 */
export async function handleDeliveryOrderType(page: Page): Promise<void> {
  console.log('Handling delivery order type...');
  
  // Wait for the search input to appear
  console.log('Waiting for search input with data-testid="search-input"...');
  const searchInput = page.getByTestId('search-input');
  await searchInput.waitFor({ state: 'visible', timeout: 30000 });
  console.log('Search input appeared');
  
  // Enter the text "BJ's Test Location 1"
  const addressText = "BJ's Test Location 1";
  console.log(`Entering address text "${addressText}"...`);
  await searchInput.fill(addressText);
  console.log(`Entered address text "${addressText}"`);
  
  // Wait for the "Confirm address" button to appear
  console.log('Waiting for button with text "Confirm address"...');
  const confirmButton = page
    .locator('button')
    .filter({ hasText: /confirm address/i })
    .first();
  await confirmButton.waitFor({ state: 'visible', timeout: 30000 });
  console.log('Found button with text "Confirm address"');
  
  // Click the "Confirm address" button
  console.log('Clicking "Confirm address" button...');
  await confirmButton.click();
  console.log('Clicked "Confirm address" button');
  
  // Wait for the "Start my order" button to appear and React state to update
  console.log('Waiting for button with text "Start my order"...');
  
  // Wait for the button to be attached to the DOM
  const startOrderButton = page
    .locator('button')
    .filter({ has: page.getByText(/start my order/i) })
    .first();
  
  await startOrderButton.waitFor({ state: 'attached', timeout: 30000 });
  console.log('Button found in DOM, waiting for React state to update...');
  
  // Wait a bit for React state to update
  await page.waitForTimeout(3000);
  
  // Try clicking via JavaScript to bypass Playwright's actionability checks
  console.log('Attempting to click button via JavaScript...');
  await startOrderButton.evaluate((button: any) => {
    button.click();
  });
  console.log('Clicked "Start my order" button via JavaScript');
}

/**
 * Handle dine-in order type UI flow
 * @param page Playwright page object
 */
export async function handleDineInOrderType(page: Page): Promise<void> {
  console.log('Handling dine-in order type...');
  
  // Wait for the button with "Order Ahead" text to appear
  console.log('Waiting for button with text "Order Ahead" and id containing "tabs"...');
  const orderAheadButton = page
    .locator('button[id*="tabs"]')
    .filter({ has: page.getByText("Order ahead") })
    .first();
  
  // Wait for the button to be attached to the DOM
  await orderAheadButton.waitFor({ state: 'attached', timeout: 30000 });
  console.log('Found button with text "Order Ahead"');
  
  // Wait for the button to be visible
  await orderAheadButton.waitFor({ state: 'visible', timeout: 30000 });
  console.log('Button is visible');
  
  // Click the "Order Ahead" button
  console.log('Clicking "Order Ahead" button...');
  await orderAheadButton.click();
  console.log('Clicked "Order Ahead" button');

  // Wait for the "2nd Order ahead" button to appear and React state to update
  console.log('Waiting for button with text "Order ahead" (id must not contain "tabs")...');
  
  // Wait for the button to be attached to the DOM
  // Exclude buttons whose id contains "tabs"
  const SecondOrderAheaButton = page
    .locator('button:not([id*="tabs"])')
    .filter({ has: page.getByText("Order ahead") })
    .first();
  
  await SecondOrderAheaButton.waitFor({ state: 'attached', timeout: 30000 });
  console.log('Button found in DOM, waiting for React state to update...');
  
  // Wait a bit for React state to update
  await page.waitForTimeout(5000);
  
  // Try clicking via JavaScript to bypass Playwright's actionability checks
  console.log('Attempting to click button via JavaScript...');
  await SecondOrderAheaButton.evaluate((button: any) => {
    button.click();
  });
  console.log('Clicked "SecondOrder ahead" button via JavaScript');
  
}

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
 * Build the location URL from configuration
 * @returns The complete location URL
 */
export function buildLocationUrl(): string {
  const baseUrl = config.bjsWebUrl.replace(/\/$/, ''); // Remove trailing slash if present
  const locationPath = config.bjsLocationPath.replace(/^\//, ''); // Remove leading slash if present
  return `${baseUrl}/${locationPath}`;
}

/**
 * Search for location and select it by clicking "Choose location" button
 * Uses recursion to try each button index until the desired location is found
 * @param page Playwright page object
 * @param searchingSiteName Site name to search for
 * @param locationId Location ID to select (from locationParsed.id)
 * @param buttonIndex Button index to try (0-based), defaults to 0
 * @returns Promise that resolves to true if location was found and selected, false otherwise
 */
export async function searchAndSelectLocation(
  page: Page,
  searchingSiteName: string,
  locationId: string,
  buttonIndex: number = 0
): Promise<boolean> {
  // Navigate directly to the find location page
  const findLocationUrl = buildFindLocationUrl();
  console.log(`Navigating to find location URL: ${findLocationUrl}`);
  await page.goto(findLocationUrl, {waitUntil: 'domcontentloaded'});

  // Wait for the search input to appear
  console.log('Waiting for search input to appear...');
  const searchInput = page.getByTestId('search-input');
  await page.waitForTimeout(5000);
  await searchInput.waitFor({ state: 'visible', timeout: 30000 });
  console.log('Search input appeared');

  // Type site name into the search input
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

  // Find all buttons within li that contain the site name
  console.log(`Looking for buttons containing "${searchingSiteName}" in location list...`);
  const locationButtons = locationList
    .locator('li')
    .locator('button');
  
  const buttonCount = await locationButtons.count();
  console.log(`Found ${buttonCount} button(s) containing "${searchingSiteName}"`);

  if (buttonCount === 0) {
    console.warn(`No buttons found containing "${searchingSiteName}"`);
    return false;
  }

  // Check if buttonIndex is out of range
  if (buttonIndex >= buttonCount) {
    console.warn(`Button index ${buttonIndex} is out of range (max: ${buttonCount - 1})`);
    return false;
  }

  console.log(`\nAttempt ${buttonIndex + 1}: Trying button index ${buttonIndex}...`);

  // Get the button at the current index
  const locationButton = locationButtons.nth(buttonIndex);
  await locationButton.waitFor({ state: 'visible', timeout: 30000 });
  console.log(`Found button ${buttonIndex + 1} of ${buttonCount}`);

  // Click the button
  console.log(`Clicking location button ${buttonIndex + 1}...`);
  await locationButton.click();
  console.log(`Clicked location button ${buttonIndex + 1}`);

  // Wait for the first location list to disappear
  console.log('Waiting for first location list to disappear...');
  await locationList.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {
    // If it doesn't disappear, that's okay, continue
    console.log('First location list did not disappear, continuing...');
  });

  // Wait for a new ul list to appear after clicking the first item
  console.log('Waiting for new location list to appear after clicking first item...');
  
  // Wait for a ul that contains an li with the site name
  const secondLocationList = page
    .locator('ul')
    .filter({ has: page.locator('li').filter({ hasText: searchingSiteName }) })
    .first();
  
  try {
    await secondLocationList.waitFor({ state: 'visible', timeout: 30000 });
    console.log('New location list appeared after clicking first item');

    // Find and select the li with id matching locationParsed.id
    console.log(`Looking for li with id="${locationId}" in new location list...`);
    const secondListItem = secondLocationList
      .locator(`li[id="${locationId}"]`)
      .first();
    
    try {
      await secondListItem.waitFor({ state: 'visible', timeout: 30000 });
      console.log(`Found li with id="${locationId}" in new location list`);
      
      // Click the li item that matches the location ID
      console.log(`Clicking li item with id="${locationId}"...`);
      await secondListItem.click();
      console.log(`Clicked li item with id="${locationId}"`);
      
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
      
      // Wait for new page to appear (about 5 seconds)
      console.log('Waiting for new page to appear (3 seconds)...');
      await page.waitForTimeout(3000);
      
      console.log(`Successfully found and selected location with id="${locationId}" using button ${buttonIndex + 1}`);
      return true; // Successfully found and clicked
    } catch (error) {
      console.warn(`Li with id="${locationId}" not found in new location list for button ${buttonIndex + 1}`);
      // Recursively try the next button index
      return await searchAndSelectLocation(page, searchingSiteName, locationId, buttonIndex + 1);
    }
  } catch (error) {
    console.warn(`New location list did not appear after clicking button ${buttonIndex + 1}`);
    // Recursively try the next button index
    return await searchAndSelectLocation(page, searchingSiteName, locationId, buttonIndex + 1);
  }
}

/**
 * Navigate to location page and select order type
 * @param page Playwright page object
 * @param orderType Order type: 'takeout', 'delivery', or 'dinein'
 * @returns Promise that resolves when order type is selected
 */
export async function selectOrderType(
  page: Page,
  orderType?: 'takeout' | 'delivery' | 'dinein'
): Promise<void> {
  // Navigate to BJs_Location_Path
  const locationUrl = buildLocationUrl();
  console.log(`Navigating to location URL: ${locationUrl}`);
  await page.goto(locationUrl);
  console.log('Navigated to location page');
  await page.waitForTimeout(5000);
  
  // If orderType is provided, find the input with placeholder matching the order type
  if (orderType) {
    const orderTypeText = ORDER_TYPE_TEXT_MAP[orderType];
    const placeholderText = `${orderTypeText} radio`;
    console.log(`Looking for input with placeholder "${placeholderText}"...`);
    
    // Find input with placeholder matching the order type
    const inputElement = page.locator(`input[placeholder="${placeholderText}"]`).first();
    
    try {
      await inputElement.waitFor({ state: 'visible', timeout: 30000 });
      console.log(`Found input with placeholder "${placeholderText}"`);
      
      // Click on the input (it's a regular input, not a radio button)
      console.log(`Clicking input with placeholder "${placeholderText}"...`);
      // Try clicking with force option in case the element is covered
      await inputElement.click({ force: true });
      await page.waitForTimeout(1000);
      console.log(`Clicked input with placeholder "${placeholderText}"`);
      
      // Click on the button with text "Order <mapped_value>" (case insensitive)
      const orderButtonText = `Order ${orderTypeText}`;
      console.log(`Looking for button with text "${orderButtonText}" (case insensitive)...`);
      const orderButton = page
        .locator('button')
        .filter({ hasText: new RegExp(`^Order ${orderTypeText}$`, 'i') })
        .first();
      
      try {
        await orderButton.waitFor({ state: 'visible', timeout: 30000 });
        console.log(`Found button with text "${orderButtonText}"`);
        
        console.log(`Clicking button with text "${orderButtonText}"...`);
        await orderButton.click();
        console.log(`Clicked button with text "${orderButtonText}"`);
      } catch (error) {
        console.warn(`Button with text "${orderButtonText}" not found`);
      }
      
      // Call the appropriate handler function based on order type
      switch (orderType) {
        case 'takeout':
          await handleTakeoutOrderType(page);
          break;
        case 'delivery':
          await handleDeliveryOrderType(page);
          break;
        case 'dinein':
          await handleDineInOrderType(page);
          break;
      }
    } catch (error) {
      console.log(`Input with placeholder "${placeholderText}" not found:`, error);
    }
  }
}

/**
 * Navigate to find location page and enter search text
 * @param page Playwright page object
 * @param searchingSiteName Site name to search for
 * @param locationId Location ID to select (from locationParsed.id)
 * @param orderType Order type: 'takeout', 'delivery', or 'dinein'
 */
export async function waitForFindLocationPageAndSearchInputAndSelectOrderType(
  page: Page,
  searchingSiteName: string,
  locationId: string,
  orderType?: 'takeout' | 'delivery' | 'dinein'
): Promise<boolean> {
  // Use the extracted function to search and select location (starts with buttonIndex 0)
  const locationSelected = await searchAndSelectLocation(page, searchingSiteName, locationId, 0);
  
  if (!locationSelected) {
    return false;
  }
  
  // Use the extracted function to select order type
  await selectOrderType(page, orderType);
  
  return true; // Successfully found and clicked
}

