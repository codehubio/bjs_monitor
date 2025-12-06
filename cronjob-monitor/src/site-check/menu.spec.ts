import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';
import { navigateToFindLocationPage } from './fixture';
import { ProductChange } from '../types';

/**
 * Read products-changes.json and extract unique location names and IDs
 */
function getLocationsFromProductsChanges(): Array<{ name: string; id: string }> {
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

  // Extract unique locations (name and id) from all changes
  const locationMap = new Map<string, string>();

  // Get locations from added changes (use friday location)
  data.changes.added.forEach(change => {
    if (change.friday.locationParsed?.name && change.friday.locationParsed?.id) {
      locationMap.set(change.friday.locationParsed.name, change.friday.locationParsed.id);
    }
  });

  // Get locations from removed changes (use thursday location)
  data.changes.removed.forEach(change => {
    if (change.thursday.locationParsed?.name && change.thursday.locationParsed?.id) {
      locationMap.set(change.thursday.locationParsed.name, change.thursday.locationParsed.id);
    }
  });

  // Get locations from modified changes (use friday location)
  data.changes.modified.forEach(change => {
    if (change.friday.locationParsed?.name && change.friday.locationParsed?.id) {
      locationMap.set(change.friday.locationParsed.name, change.friday.locationParsed.id);
    }
  });

  // Get locations from moved changes (use friday location)
  data.changes.moved.forEach(change => {
    if (change.friday.locationParsed?.name && change.friday.locationParsed?.id) {
      locationMap.set(change.friday.locationParsed.name, change.friday.locationParsed.id);
    }
  });

  // Convert to array and sort by name
  return Array.from(locationMap.entries())
    .map(([name, id]) => ({ name, id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

test.describe('BJs Menu Page', () => {
  test('should visit the menu page and search for locations from products-changes.json', async ({ browser }) => {
    // Get locations (name and id) from products-changes.json
    const locations = getLocationsFromProductsChanges();
    console.log(`Found ${locations.length} unique locations: ${locations.map(l => `${l.name} (${l.id})`).join(', ')}`);

    // Create screenshot directory if it doesn't exist
    const screenshotDir = path.resolve(__dirname, '../../result/screenshot');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
      console.log(`Created screenshot directory: ${screenshotDir}`);
    }

    // Test each location with a new browser context/page
    for (const location of locations) {
      console.log(`\nTesting location: ${location.name} (ID: ${location.id})`);
      
      // Create a new browser context for this location
      const context = await browser.newContext({
        permissions: ['geolocation'],
        viewport: null,
      });
      const page = await context.newPage();
      
      try {
        // Navigate to find location page, search for location, and select by ID
        await navigateToFindLocationPage(page, location.name, location.id, "delivery");

        // Wait a bit for the second list to fully render
        await page.waitForTimeout(2000);

        // Take a screenshot for this location
        const screenshotFilename = `menu-page-${location.name.replace(/\s+/g, '-')}.png`;
        const screenshotPath = path.join(screenshotDir, screenshotFilename);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Screenshot saved: ${screenshotPath}`);

        // Verify page loaded successfully
        const baseUrl = config.bjsWebUrl.replace(/\/$/, '');
        expect(page.url()).toContain(baseUrl);
      } finally {
        // Close the page and context for this location
        await page.close();
        await context.close();
      }
    }
  });
});

