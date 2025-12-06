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
  console.log('Handling takeout order type...');
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
  await page.waitForTimeout(2000);
  
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
  // TODO: Implement dine-in-specific UI handling
  console.log('Handling dine-in order type...');
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
 * Navigate to find location page and enter search text
 * @param page Playwright page object
 * @param searchingSiteName Site name to search for
 * @param locationId Location ID to select (from locationParsed.id)
 * @param buttonIndex Button index to try (0-based)
 * @param orderType Order type: 'takeout', 'delivery', or 'dinein'
 */
export async function waitForFindLocationPageAndSearchInput(
  page: Page,
  searchingSiteName: string,
  locationId: string,
  buttonIndex: number = 0,
  orderType?: 'takeout' | 'delivery' | 'dinein'
): Promise<boolean> {
  // Navigate directly to the find location page
  const findLocationUrl = buildFindLocationUrl();
  console.log(`Navigating to find location URL: ${findLocationUrl}`);
  await page.goto(findLocationUrl);

  // Wait for the search input to appear
  console.log('Waiting for search input to appear...');
  const searchInput = page.getByTestId('search-input');
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

  if (buttonIndex >= buttonCount) {
    console.warn(`Button index ${buttonIndex} is out of range (max: ${buttonCount - 1})`);
    return false;
  }

  // Get the button at the specified index
  const locationButton = locationButtons.nth(buttonIndex);
  await locationButton.waitFor({ state: 'visible', timeout: 30000 });
  console.log(`Found button ${buttonIndex + 1} of ${buttonCount} containing "${searchingSiteName}"`);

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
  // The ul has many li, and one li (or its direct/indirect children) has the site name in the text
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
        
        // Navigate to BJs_Location_Path
        const locationUrl = buildLocationUrl();
        console.log(`Navigating to location URL: ${locationUrl}`);
        await page.goto(locationUrl);
        console.log('Navigated to location page');
        
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
            console.log(error);
          }
        }
        
        return true; // Successfully found and clicked
    } catch (error) {
      console.warn(`Li with id="${locationId}" not found in new location list`);
      return false; // Not found, need to try next button
    }
  } catch (error) {
    console.warn(`New location list did not appear after clicking button ${buttonIndex + 1}`);
    return false; // Not found, need to try next button
  }
}

/**
 * Complete flow: Navigate to find location page and enter search text
 * Tries each button until secondListItem is found
 * @param page Playwright page object
 * @param searchingSiteName Site name to search for in the search input
 * @param locationId Location ID to select (from locationParsed.id)
 * @param orderType Order type: 'takeout', 'delivery', or 'dinein'
 */
export async function navigateToFindLocationPage(
  page: Page,
  searchingSiteName: string,
  locationId: string,
  orderType?: 'takeout' | 'delivery' | 'dinein'
): Promise<void> {
  // Try each button until we find the one that leads to the correct secondListItem
  let buttonIndex = 0;
  let found = false;
  
  while (!found) {
    console.log(`\nAttempt ${buttonIndex + 1}: Trying button index ${buttonIndex}...`);
    found = await waitForFindLocationPageAndSearchInput(page, searchingSiteName, locationId, buttonIndex, orderType);
    
    if (found) {
      console.log(`Successfully found and selected location with id="${locationId}" using button ${buttonIndex + 1}`);
      break;
    }
    
    buttonIndex++;
    console.log(`Button ${buttonIndex} did not lead to correct location, trying next button...`);
    
    // Safety check to avoid infinite loop
    if (buttonIndex > 10) {
      console.warn(`Tried ${buttonIndex} buttons but could not find location with id="${locationId}", giving up`);
      throw new Error(`Could not find location with id="${locationId}" after trying ${buttonIndex} buttons`);
    }
  }
}

