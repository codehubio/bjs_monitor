import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';
import { navigateToFindLocationPage } from './fixture';
import { ProductChange } from '../types';
import { uploadScreenshotsAndSendToMsTeams } from '../util/sendToMsTeam';

/**
 * Check item availability for different order types
 * @param change ProductChange item to check
 * @returns Array of available order types: 'takeout', 'delivery', 'dinein'
 */
function getAvailableOrderTypes(change: ProductChange): Array<'takeout' | 'delivery' | 'dinein'> {
  const availableOrderTypes: Array<'takeout' | 'delivery' | 'dinein'> = [];
  
  // Check menuItemInfo for availability flags
  const menuItemInfo = change.menuItemInfo;
  if (!menuItemInfo) {
    // If no menuItemInfo, assume all order types are available
    return ['takeout', 'delivery', 'dinein'];
  }
  
  // Check TakeoutHidden
  if (menuItemInfo.TakeoutHidden === "0") {
    availableOrderTypes.push('takeout');
  }
  
  // Check DineInHidden
  if (menuItemInfo.DineInHidden === "0") {
    availableOrderTypes.push('dinein');
  }
  
  // Check DeliveryHidden
  if (menuItemInfo.DeliveryHidden === "0") {
    availableOrderTypes.push('delivery');
  }
  
  return availableOrderTypes;
}

/**
 * Read products-changes.json and extract all items with their locationParsed
 */
function getItemsFromProductsChanges(): Array<{ 
  change: ProductChange; 
  changeType: 'added' | 'removed' | 'modified' | 'moved';
  locationParsed: { name: string; id: string };
}> {
  const jsonPath = path.resolve(__dirname, '../../result/products-changes.json');
  
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Products changes file not found: ${jsonPath}`);
  }

  const fileContent = fs.readFileSync(jsonPath, 'utf-8');
  const data: {
    summary: any;
    changes: {
      added: ProductChange[];
      removed: ProductChange[];
      modified: ProductChange[];
      moved: ProductChange[];
    };
  } = JSON.parse(fileContent);

  const items: Array<{ 
    change: ProductChange; 
    changeType: 'added' | 'removed' | 'modified' | 'moved';
    locationParsed: { name: string; id: string };
  }> = [];

  // Get items from added changes (use after location)
  data.changes.added.forEach(change => {
    if (change.after.locationParsed?.name && change.after.locationParsed?.id) {
      items.push({
        change,
        changeType: 'added',
        locationParsed: {
          name: change.after.locationParsed.name,
          id: change.after.locationParsed.id
        }
      });
    }
  });

  // Get items from removed changes (use before location)
  data.changes.removed.forEach(change => {
    if (change.before.locationParsed?.name && change.before.locationParsed?.id) {
      items.push({
        change,
        changeType: 'removed',
        locationParsed: {
          name: change.before.locationParsed.name,
          id: change.before.locationParsed.id
        }
      });
    }
  });

  // Get items from modified changes (use after location)
  data.changes.modified.forEach(change => {
    if (change.after.locationParsed?.name && change.after.locationParsed?.id) {
      items.push({
        change,
        changeType: 'modified',
        locationParsed: {
          name: change.after.locationParsed.name,
          id: change.after.locationParsed.id
        }
      });
    }
  });

  // Get items from moved changes (use after location)
  data.changes.moved.forEach(change => {
    if (change.after.locationParsed?.name && change.after.locationParsed?.id) {
      items.push({
        change,
        changeType: 'moved',
        locationParsed: {
          name: change.after.locationParsed.name,
          id: change.after.locationParsed.id
        }
      });
    }
  });

  return items;
}

test.describe('BJs Menu Page', () => {
  test('should visit the menu page and search for locations from products-changes.json', async ({ browser }) => {
    // Get all items from products-changes.json
    const items = getItemsFromProductsChanges();
    console.log(`Found ${items.length} items to process`);

    // Create screenshot directory if it doesn't exist
    const screenshotDir = path.resolve(__dirname, '../../result/screenshot');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
      console.log(`Created screenshot directory: ${screenshotDir}`);
    }

    // Array to collect data for MS Teams notification
    const teamsData: Array<{
      locationId: string;
      locationName: string;
      categoryId: string;
      categoryName: string;
      productId: string;
      productName: string;
      screenshotPath: string | null;
    }> = [];

    // Test each item with a new browser context/page
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const { change, changeType, locationParsed } = item;
      
      // Skip items that don't have productParsed.name in the "after" part
      if (!change.after.productParsed?.name) {
        console.log(`\nSkipping ${changeType} item - Location: ${locationParsed.name} (ID: ${locationParsed.id}) - No product name in "after" part`);
        continue;
      }
      
      // Get supported order types for this item
      const availableOrderTypes = getAvailableOrderTypes(change);
      
      // Skip if no order types are available
      if (availableOrderTypes.length === 0) {
        console.log(`\nSkipping ${changeType} item - Location: ${locationParsed.name} (ID: ${locationParsed.id}) - No supported order types`);
        continue;
      }
      
      // Use the first supported order type
      const orderType = availableOrderTypes[0];
      
      // Output item details before proceeding (one line)
      console.log(`\nProcessing ${changeType} | Location ID: ${locationParsed.id} | Location Name: ${locationParsed.name} | Category ID: ${change.after.categoryParsed?.id || 'N/A'} | Category Name: ${change.after.categoryParsed?.name || 'N/A'} | Item ID: ${change.after.productParsed?.id || 'N/A'} | Item Name: ${change.after.productParsed?.name || 'N/A'} | Order Type: ${orderType}`);
      
      // Create a new browser context for this item
      const context = await browser.newContext({
        permissions: ['geolocation'],
        viewport: null,
      });
      const page = await context.newPage();
      
      try {
        // Navigate to find location page, search for location, and select by ID
        await navigateToFindLocationPage(page, locationParsed.name, locationParsed.id, orderType);

        // Wait a bit for the second list to fully render
        await page.waitForTimeout(2000);
        
        // Track product URL for Teams notification
        let productUrl: string = 'Not found';
        
        // For added items, wait for the <a> tag containing the product name
        if (changeType === 'added' && change.after.productParsed?.name) {
          const productName = change.after.productParsed.name;
          console.log(`Waiting for <a> tag containing product name: "${productName}"...`);
          
          const productLink = page
            .locator('a')
            .filter({ has: page.getByText(productName) })
            .first();
          
          try {
            await productLink.waitFor({ state: 'visible', timeout: 15000 });
            console.log(`Found <a> tag containing product name: "${productName}"`);
            
            // Get the href and visit it
            const href = await productLink.getAttribute('href');
            if (href) {
              productUrl = href;
              console.log(`Visiting href: ${href}`);
              await page.goto(href);
              console.log(`Visited href: ${href}`);
              
              // Wait for 5 seconds
              console.log('Waiting 5 seconds for potential age confirmation dialog...');
              await page.waitForTimeout(3000);
              
              // Check if age confirmation dialog appears
              const ageConfirmationButton = page
                .locator('button')
                .filter({ has: page.getByText(/yes, i am/i) })
                .first();
              
              try {
                // Try to find the button (with short timeout to check if dialog exists)
                await ageConfirmationButton.waitFor({ state: 'visible', timeout: 2000 });
                console.log('Age confirmation dialog detected, clicking "YES, I AM" button...');
                await ageConfirmationButton.click();
                console.log('Clicked "YES, I AM" button');
                await ageConfirmationButton.waitFor({ state: 'visible', timeout: 3000 });
                await page.waitForTimeout(3000);
              } catch (error) {
                // Dialog didn't appear, which is fine
                console.log('No age confirmation dialog appeared');
              }
            } else {
              console.warn(`No href found on <a> tag containing product name: "${productName}"`);
            }
          } catch (error) {
            // Product link not found
            console.log(`Product link not found for "${productName}"`);
            productUrl = 'Not found';
          }
        }

        // Take a screenshot for this item only if product link was found
        let screenshotPath: string | null = null;
        
        if (productUrl !== 'Not found') {
          // Format: year-month-date-location_id-location_name-category_id-category_name-product_id-product_name-order_type
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          
          // Helper function to sanitize filename parts
          const sanitize = (str: string): string => {
            return str
              .replace(/\s+/g, '-')
              .replace(/[^a-zA-Z0-9\-]/g, '')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, '');
          };
          
          const locationId = locationParsed.id || 'N/A';
          const locationName = sanitize(locationParsed.name || 'N/A');
          const categoryId = change.after.categoryParsed?.id || 'N/A';
          const categoryName = sanitize(change.after.categoryParsed?.name || 'N/A');
          const productId = change.after.productParsed?.id || 'N/A';
          const productName = sanitize(change.after.productParsed?.name || 'N/A');
          
          const screenshotFilename = `${dateStr}-${locationId}-${locationName}-${categoryId}-${categoryName}-${productId}-${productName}-${orderType}.png`;
          screenshotPath = path.join(screenshotDir, screenshotFilename);
          
          console.log(`Screenshot filename: ${screenshotFilename}`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          console.log(`Screenshot saved: ${screenshotPath}`);
        } else {
          console.log('Skipping screenshot since product link was not found');
        }

        // Collect data for MS Teams notification
        teamsData.push({
          locationId: locationParsed.id || 'N/A',
          locationName: locationParsed.name || 'N/A',
          categoryId: change.after.categoryParsed?.id || 'N/A',
          categoryName: change.after.categoryParsed?.name || 'N/A',
          productId: change.after.productParsed?.id || 'N/A',
          productName: change.after.productParsed?.name || 'N/A',
          screenshotPath: screenshotPath,
        });

        // Verify page loaded successfully
        const baseUrl = config.bjsWebUrl.replace(/\/$/, '');
        expect(page.url()).toContain(baseUrl);
      } finally {
        // Close the page and context for this item
        await page.close();
        await context.close();
      }
    }

    // Send all screenshots to MS Teams
    if (teamsData.length > 0) {
      console.log(`\nUploading ${teamsData.length} screenshot(s) to S3 and sending to MS Teams...`);
      try {
        await uploadScreenshotsAndSendToMsTeams(
          'Product Screenshots',
          teamsData
        );
        console.log('Successfully sent screenshots to MS Teams');
      } catch (error) {
        console.error('Failed to send screenshots to MS Teams:', error);
        // Don't fail the test if MS Teams sending fails
      }
    } else {
      console.log('\nNo screenshots to send to MS Teams');
    }
  });
});

