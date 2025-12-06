import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';
import { navigateToFindLocationPage } from './fixture';
import { ProductChange } from '../types';

/**
 * Read products-changes.json and extract unique location names
 */
function getLocationNamesFromProductsChanges(): string[] {
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

  // Extract unique location names from all changes
  const locationNames = new Set<string>();

  // Get locations from added changes (use friday location)
  data.changes.added.forEach(change => {
    if (change.friday.locationParsed?.name) {
      locationNames.add(change.friday.locationParsed.name);
    }
  });

  // Get locations from removed changes (use thursday location)
  data.changes.removed.forEach(change => {
    if (change.thursday.locationParsed?.name) {
      locationNames.add(change.thursday.locationParsed.name);
    }
  });

  // Get locations from modified changes (use friday location)
  data.changes.modified.forEach(change => {
    if (change.friday.locationParsed?.name) {
      locationNames.add(change.friday.locationParsed.name);
    }
  });

  // Get locations from moved changes (use friday location)
  data.changes.moved.forEach(change => {
    if (change.friday.locationParsed?.name) {
      locationNames.add(change.friday.locationParsed.name);
    }
  });

  return Array.from(locationNames).sort();
}

test.describe('BJs Menu Page', () => {
  test('should visit the menu page and search for locations from products-changes.json', async ({ page }) => {
    // Get location names from products-changes.json
    const locationNames = getLocationNamesFromProductsChanges();
    console.log(`Found ${locationNames.length} unique locations: ${locationNames.join(', ')}`);

    // Create screenshot directory if it doesn't exist
    const screenshotDir = path.resolve(__dirname, '../../result/screenshot');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
      console.log(`Created screenshot directory: ${screenshotDir}`);
    }

    // Test each location
    for (const locationName of locationNames) {
      console.log(`\nTesting location: ${locationName}`);
      
      // Navigate to menu, click Change Location, wait for find-location page, and search for location
      await navigateToFindLocationPage(page, locationName);

      // Wait a bit for the second list to fully render
      await page.waitForTimeout(2000);

      // Take a screenshot for this location
      const screenshotFilename = `menu-page-${locationName.replace(/\s+/g, '-')}.png`;
      const screenshotPath = path.join(screenshotDir, screenshotFilename);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Screenshot saved: ${screenshotPath}`);

      // Verify page loaded successfully
      const baseUrl = config.bjsWebUrl.replace(/\/$/, '');
      expect(page.url()).toContain(baseUrl);
    }
  });
});

