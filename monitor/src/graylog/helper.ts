import { Page, expect } from '@playwright/test';
import { config } from '../config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Helper functions for Graylog automation
 */
export class GraylogHelper {
  constructor(private page: Page) {}

  /**
   * Login to Graylog with credentials from environment variables and optionally visit a URL
   * @param username Optional username (defaults to GRAYLOG_USERNAME from .env)
   * @param password Optional password (defaults to GRAYLOG_PASSWORD from .env)
   * @param redirectUrl Optional URL to redirect to after successful login
   */
  async loginAndVisit(username?: string, password?: string, redirectUrl?: string): Promise<void> {
    const loginUsername = username || config.graylogUsername;
    const loginPassword = password || config.graylogPassword;

    if (!loginUsername || !loginPassword) {
      throw new Error('Graylog username and password must be set in .env file (GRAYLOG_USERNAME and GRAYLOG_PASSWORD)');
    }


    // Navigate to Graylog
    await this.page.goto(config.graylogWebUrl);

    // Wait for login form to be visible
    // Common Graylog login selectors - adjust based on your Graylog version
    const usernameSelector = this.page.locator('input[name="username"], input[type="text"][placeholder*="username" i], input[type="text"][placeholder*="user" i], input#username, input[type="email"]').first();
    const passwordSelector = this.page.locator('input[name="password"], input[type="password"]').first();
    const loginButtonSelector = this.page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login")').first();

    // Wait for login form elements
    await usernameSelector.waitFor({ state: 'visible', timeout: 10000 });
    await passwordSelector.waitFor({ state: 'visible', timeout: 10000 });

    // Fill in credentials
    await usernameSelector.fill(loginUsername);
    await passwordSelector.fill(loginPassword);

    // Click login button
    await loginButtonSelector.click();

    // Wait for login form to disappear (indicates successful login)
    try {
      await usernameSelector.waitFor({ state: 'hidden', timeout: 15000 });
    } catch {
      // If form doesn't disappear, wait a bit more
      await this.page.waitForTimeout(3000);
    }

    // Check for error messages that might indicate login failure
    const errorMessage = this.page.locator('.alert-error, .error, [role="alert"], .alert-danger, [class*="error"], [class*="alert"]').first();
    const errorVisible = await errorMessage.isVisible({ timeout: 2000 }).catch(() => false);
    if (errorVisible) {
      const errorText = await errorMessage.textContent();
      throw new Error(`Login failed: ${errorText || 'Unknown error'}`);
    }

    // Check if login form fields are still visible (indicates login failed)
    const usernameStillVisible = await usernameSelector.isVisible({ timeout: 2000 }).catch(() => false);
    const passwordStillVisible = await passwordSelector.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (usernameStillVisible && passwordStillVisible) {
      throw new Error('Login failed - login form is still visible');
    }

    // If redirectUrl is provided, navigate to it after successful login
    if (redirectUrl) {
      await this.page.goto(redirectUrl, { waitUntil: 'domcontentloaded' });
    }
  }

  /**
   * Check if user is already logged in by redirecting and checking for login form fields
   */
  async isLoggedIn(): Promise<boolean> {
    // Navigate to Graylog to check login status
    await this.page.goto(config.graylogWebUrl);

    // Check for username and password input fields
    // If these fields exist, it means we're on the login page and NOT logged in
    const usernameSelector = this.page.locator('input[name="username"], input[type="text"][placeholder*="username" i], input[type="text"][placeholder*="user" i], input#username, input[type="email"]').first();
    const passwordSelector = this.page.locator('input[name="password"], input[type="password"]').first();

    // Wait for either login form or navigation elements to appear
    await Promise.race([
      usernameSelector.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null),
      this.page.waitForSelector('nav, [class*="dashboard"], [class*="search"]', { timeout: 5000 }).catch(() => null)
    ]);

    // Check if login form fields are visible
    const usernameVisible = await usernameSelector.isVisible({ timeout: 3000 }).catch(() => false);
    const passwordVisible = await passwordSelector.isVisible({ timeout: 3000 }).catch(() => false);

    // If both username and password fields are visible, we're on the login page (not logged in)
    if (usernameVisible && passwordVisible) {
      return false;
    }

    // If login fields are not visible, we're logged in
    return true;
  }

  /**
   * Build a Graylog stream URL
   * @param streamId The stream ID
   * @returns The full URL to the stream search page
   */
  buildStreamUrl(streamId: string): string {
    // Ensure streamId doesn't have leading/trailing slashes
    const cleanStreamId = streamId.trim().replace(/^\/+|\/+$/g, '');
    
    // Build the stream URL path
    const streamPath = `/streams/${cleanStreamId}/search`;
    
    // Combine with base URL, ensuring no double slashes
    const baseUrl = config.graylogWebUrl.replace(/\/+$/, '');
    const path = streamPath.startsWith('/') ? streamPath : `/${streamPath}`;
    
    return `${baseUrl}${path}`;
  }

  /**
   * Build a Graylog search view URL
   * @param searchViewId The search view ID
   * @returns The full URL to the search view page
   */
  buildSearchViewUrl(searchViewId: string): string {
    if (!searchViewId) {
      throw new Error('Search view ID is required');
    }
    
    // Ensure viewId doesn't have leading/trailing slashes
    const cleanViewId = searchViewId.trim().replace(/^\/+|\/+$/g, '');
    
    // Build the search view URL path
    const searchViewPath = `/search/${cleanViewId}`;
    
    // Combine with base URL, ensuring no double slashes
    const baseUrl = config.graylogWebUrl.replace(/\/+$/, '');
    const path = searchViewPath.startsWith('/') ? searchViewPath : `/${searchViewPath}`;
    
    return `${baseUrl}${path}`;
  }

  /**
   * Login if needed and visit a search view page
   * @param searchViewId The search view ID
   * @param username Optional username (defaults to GRAYLOG_USERNAME from .env)
   * @param password Optional password (defaults to GRAYLOG_PASSWORD from .env)
   */
  async loginAndVisitSearchView(searchViewId: string, username?: string, password?: string): Promise<void> {
    // Browser window is maximized via --start-maximized launch argument
    
    // Check if already logged in
    const loggedIn = await this.isLoggedIn();
    
    if (!loggedIn) {
      // Build the search view URL
      const searchViewUrl = this.buildSearchViewUrl(searchViewId);
      // Login and visit the search view page
      await this.loginAndVisit(username, password, searchViewUrl);
    } else {
      // Already logged in, just navigate to the search view page
      const searchViewUrl = this.buildSearchViewUrl(searchViewId);
      await this.page.goto(searchViewUrl, { waitUntil: 'domcontentloaded' });
      // Wait for URL to contain the expected path
      await this.page.waitForURL(url => {
        const currentPath = url.pathname;
        return currentPath.includes('/search/');
      }, { timeout: 15000 });
      // Wait for the search input to be available (indicates page is ready)
      let searchInput = this.page.locator('input[placeholder*="Type your search query here and press enter" i], textarea[placeholder*="Type your search query here and press enter" i]').first();
      await searchInput.waitFor({ state: 'visible', timeout: 10000 }).catch(async () => {
        // If not found by placeholder, try finding textarea with child div
        searchInput = this.page.locator('textarea:has(div:has-text("Type your search query here and press enter"))').first();
        await searchInput.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
          // If search input not found, wait for any navigation element
          return this.page.waitForSelector('nav, [class*="search"], [class*="stream"]', { timeout: 10000 });
        });
      });
    }
    const currentUrl = this.page.url();
    expect(currentUrl).toContain('/search/');
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).not.toContain('/signin');

    // Step 3: Verify page loaded successfully by checking for common search elements
    // Wait for page to be fully loaded
    await this.page.waitForLoadState('domcontentloaded');
    
    // Check for common elements that indicate the search view page is loaded
    const pageLoaded = await Promise.race([
      this.page.waitForSelector('nav', { timeout: 5000 }).then(() => true).catch(() => false),
      this.page.waitForSelector('[class*="search"]', { timeout: 5000 }).then(() => true).catch(() => false),
      this.page.waitForSelector('textarea', { timeout: 5000 }).then(() => true).catch(() => false),
    ]);

    expect(pageLoaded).toBe(true);
  }

  /**
   * Enter query text into the search textbox
   * @param queryText The search query text to enter
   * @param pressEnter Whether to press Enter after entering the text (default: true)
   */
  async enterQueryText(queryText: string, pressEnter: boolean = true): Promise<void> {
    // Locate the search textbox - try multiple strategies
    let queryInput;
    
    // Strategy 1: Try placeholder attribute
    queryInput = this.page.locator('input[placeholder*="Type your search query here and press enter" i], textarea[placeholder*="Type your search query here and press enter" i]').first();
    let found = await queryInput.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (!found) {
      // Strategy 2: Find textarea that has a child div with the text "Type your search query here and press enter"
      // The div is a child of the textarea, so find textarea that contains the div
      queryInput = this.page.locator('textarea:has(div:has-text("Type your search query here and press enter"))').first();
      found = await queryInput.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (!found) {
        // Strategy 3: Fallback to first textarea (since it's a textarea, not input)
        queryInput = this.page.locator('textarea').first();
      }
    }
    
    // Wait for the input to be visible
    await queryInput.waitFor({ state: 'visible', timeout: 10000 });
    
    // Clear any existing text and enter the new query
    await queryInput.clear();
    await queryInput.fill(queryText);
    
    // Press Enter if requested
    if (pressEnter) {
      // Wait for the API response after submitting the query
      const responsePromise = this.page.waitForResponse(
        response => response.url().includes('/api/views/search/') && response.url().includes('/execute'),
        { timeout: 30000 }
      ).catch(() => null);
      
      await queryInput.press('Enter');
      // Wait for the API call to complete
      const res = await responsePromise;
      
      // Wait for 5 seconds for the page to render the results
      await this.page.waitForTimeout(10000);
    }
  }

  /**
   * Enter query text from a JSON file into the search textbox
   * @param filePath Path to the JSON file (relative to project root or absolute path)
   * @param pressEnter Whether to press Enter after entering the text (default: true)
   * @throws Error if file doesn't exist or JSON format is invalid
   */
  async enterQueryTextFromFile(filePath: string, pressEnter: boolean = true): Promise<void> {
    // Resolve the file path (handle both relative and absolute paths)
    const resolvedPath = path.isAbsolute(filePath) 
      ? filePath 
      : path.resolve(process.cwd(), filePath);

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Query file not found: ${resolvedPath}`);
    }

    // Read and parse the JSON file
    let fileContent: string;
    try {
      fileContent = fs.readFileSync(resolvedPath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read query file: ${resolvedPath}. Error: ${error}`);
    }

    let queryData: { query: string };
    try {
      queryData = JSON.parse(fileContent);
    } catch (error) {
      throw new Error(`Failed to parse JSON from file: ${resolvedPath}. Error: ${error}`);
    }

    // Validate that the query field exists
    if (!queryData.query || typeof queryData.query !== 'string') {
      throw new Error(`Invalid JSON format in file: ${resolvedPath}. Expected format: {"query": "query_text"}`);
    }

    // Use the existing enterQueryText function
    await this.enterQueryText(queryData.query, pressEnter);
  }

  /**
   * Click on the timerange type target div to select time range
   * This is typically used after the search view is displayed
   * After clicking timerange-type-target, clicks on the absolute date/time tab
   * @param fromTime Optional start time/date string to fill in the "from" field
   * @param toTime Optional end time/date string to fill in the "to" field
   */
  async selectTimeRange(fromTime?: string, toTime?: string): Promise<void> {
    // The time format //2025-11-30 23:59:59
    // Click on the timerange type target
    await this.page.waitForSelector('#timerange-type-target', { timeout: 10000 });
    await this.page.click('#timerange-type-target');
    console.log('Clicked on timerange-type-target div');
    
    // Wait for and click on the absolute date/time tab
    await this.page.waitForSelector('#dateTimeTypes-tab-absolute', { timeout: 10000 });
    await this.page.click('#dateTimeTypes-tab-absolute');
    console.log('Clicked on dateTimeTypes-tab-absolute');
    
    // Click on the absolute time ranges heading timestamp
    await this.page.waitForSelector('#absolute-time-ranges-heading-timestamp', { timeout: 10000 });
    await this.page.click('#absolute-time-ranges-heading-timestamp');
    console.log('Clicked on absolute-time-ranges-heading-timestamp');
    
    // If fromTime is provided, fill in the "from" time field
    if (fromTime) {
      const fromInput = this.page.locator('#date-input-timeRangeTabs\\.absolute\\.from');
      await fromInput.waitFor({ state: 'visible', timeout: 10000 });
      await fromInput.clear();
      await fromInput.fill(fromTime);
      console.log(`Filled in fromTime: ${fromTime}`);
    }
    
    // If toTime is provided, fill in the "to" time field
    if (toTime) {
      const toInput = this.page.locator('#date-input-timeRangeTabs\\.absolute\\.to');
      await toInput.waitFor({ state: 'visible', timeout: 10000 });
      await toInput.clear();
      await toInput.fill(toTime);
      console.log(`Filled in toTime: ${toTime}`);
    }
    
    // Click on the "Update time range" button
    // The text is in a child element, so use has-text to find the button
    const updateButton = this.page.locator('button:has-text("Update time range")');
    await updateButton.waitFor({ state: 'visible', timeout: 10000 });
    await updateButton.click();
    console.log('Clicked on "Update time range" button');
  }

  /**
   * Get and log the "Total EAPI calls" value from the page
   * Locates the div with data-widget-id attribute, gets its second child div,
   * and gets the text from all spans with role="presentation"
   */
  async getTotalEapiCalls(): Promise<string | null> {
    // Locate the div that has the data-widget-id attribute
    const divWithWidgetId = this.page.locator('div[data-widget-id]').first();
    
    // Wait for the second child div to be visible
    await divWithWidgetId.waitFor({ state: 'visible', timeout: 10000 });
    
    // Find all spans with role="presentation" anywhere within the second child div
    const presentationSpans = divWithWidgetId.locator('span[role="presentation"]');
    
    // Get the count of spans
    const count = await presentationSpans.count();
    
    // Log all the text values
    console.log(`Found ${count} span(s) with role="presentation":`);
    for (let i = 0; i < count; i++) {
      const span = presentationSpans.nth(i);
      await span.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);
      const text = await span.textContent();
      console.log(`  Span ${i + 1}:`, text);
    }
    
    // Return the second span's text (index 1) as the totalEapiCalls value
    if (count >= 2) {
      const secondSpan = presentationSpans.nth(1);
      await secondSpan.waitFor({ state: 'visible', timeout: 10000 });
      const text = await secondSpan.textContent();
      console.log('Total EAPI calls (2nd span):', text);
      return text;
    }
    
    // If less than 2 spans found, return null
    if (count > 0) {
      console.log('Warning: Only found', count, 'span(s), expected at least 2');
    }
    
    return null;
  }
}

