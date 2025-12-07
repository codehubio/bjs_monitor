import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';
import { navigateToFindLocationPage } from './fixture';
import { ProductChange } from '../types';

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

    // Test each item with a new browser context/page
    for (const item of items) {
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
      console.log(`\nProcessing ${changeType} item - Location: ${locationParsed.name} (ID: ${locationParsed.id}) - Order Type: ${orderType} (Available: ${availableOrderTypes.join(', ')})`);
      
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
        
        // For added items, wait for the <a> tag containing the product name
        if (changeType === 'added' && change.after.productParsed?.name) {
          const productName = change.after.productParsed.name;
          console.log(`Waiting for <a> tag containing product name: "${productName}"...`);
          
          const productLink = page
            .locator('a')
            .filter({ has: page.getByText(productName) })
            .first();
          
          await productLink.waitFor({ state: 'visible', timeout: 30000 });
          console.log(`Found <a> tag containing product name: "${productName}"`);
        }

        // Take a screenshot for this item
        const screenshotFilename = `menu-page-${changeType}-${locationParsed.name.replace(/\s+/g, '-')}-${Date.now()}.png`;
        const screenshotPath = path.join(screenshotDir, screenshotFilename);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Screenshot saved: ${screenshotPath}`);

        // Verify page loaded successfully
        const baseUrl = config.bjsWebUrl.replace(/\/$/, '');
        expect(page.url()).toContain(baseUrl);
      } finally {
        // Close the page and context for this item
        await page.close();
        await context.close();
      }
    }
  });
});

