import { test, expect } from '@playwright/test';
import { GraylogHelper } from '../helper';
import { config } from '../../config';
import queries, { GROUP_BY_COLUMN } from '../searchText/paypal-error';
import * as fs from 'fs';
import * as path from 'path';
import { uploadFolderToS3 } from '../../utils/uploadToS3';
import { buildAndSendGroup1ColumnAdaptiveCard } from '../../utils/sendToMsTeams';
import { GraylogApiService } from '../api.service';

test.describe('Paypal Error Search', () => {
  test('should login, report paypal errors, wait for results', async ({ page }) => {
    const graylogHelper = new GraylogHelper(page);
    const graylogApi = new GraylogApiService();

    // Check if time range is configured
    if (!config.graylogQueryFromTime || !config.graylogQueryToTime) {
      throw new Error('GRAYLOG_QUERY_FROM_TIME and GRAYLOG_QUERY_TO_TIME environment variables must be set');
    }

    const fromTime = config.graylogQueryFromTime;
    const toTime = config.graylogQueryToTime;

    // Convert time strings (UTC format: 'YYYY-MM-DD HH:mm:ss') to ISO format for API calls
    // Parse as UTC explicitly to avoid timezone conversion issues
    const parseUTCTime = (timeStr: string): string => {
      // Format: '2025-11-29 08:00:00' -> '2025-11-29T08:00:00.000Z'
      const dateStr = timeStr.replace(' ', 'T') + '.000Z';
      return dateStr;
    };
    
    const fromTimeISO = parseUTCTime(fromTime);
    const toTimeISO = parseUTCTime(toTime);
    // Check if search view ID is configured
    if (!config.graylogPaypalSearchView) {
      throw new Error('GRAYLOG_PAYPAL_SEARCH_VIEW environment variable is not set');
    }

    // Step 1: Login if needed and visit the search view page
    await graylogHelper.loginAndVisitSearchView(config.graylogPaypalSearchView);

    // Step 2: Verify we're on the search view page (not login page)
    const currentUrl = page.url();
    expect(currentUrl).toContain('/search/');
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).not.toContain('/signin');

    // Step 3: Verify page loaded successfully by checking for common search elements
    // Wait for page to be fully loaded
    await page.waitForLoadState('domcontentloaded');
    
    // Check for common elements that indicate the search view page is loaded
    const pageLoaded = await Promise.race([
      page.waitForSelector('nav', { timeout: 5000 }).then(() => true).catch(() => false),
      page.waitForSelector('[class*="search"]', { timeout: 5000 }).then(() => true).catch(() => false),
      page.waitForSelector('textarea', { timeout: 5000 }).then(() => true).catch(() => false),
    ]);

    expect(pageLoaded).toBe(true);

    // Step 4: Click on the timerange type target div
    await graylogHelper.selectTimeRange(fromTime, toTime);

    // Generate datetime string in format dd-mm-yy-hh-MM
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const datetimeFolder = `${year}-${month}-${day}-${hour}-${minute}`;

    // Create results directory with datetime folder
    const resultsDir = path.resolve(process.cwd(), 'src','graylog','result', 'paypal', datetimeFolder);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    // Array to store results (before S3 upload, screenshots are just filenames)
    const results: Array<{
      name: { type: string; value: string };
      total: { type: string; value: number | null };
      groupedData: { type: string; value: any };
      queryIndex: { type: string; value: number };
      screenshot: { type: string; value: string };
    }> = [];

    // Step 4: Loop through each query and execute the same task
    let currentViewId = config.graylogPaypalSearchView;
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i] as any;
      console.log(`\n=== Processing Query ${i + 1}/${queries.length} ===`);
      console.log('Query Name:', query.name);
      console.log('Query:', query.query);

      // Navigate to query-specific view if provided and different from current view
      const queryView = query.view || config.graylogPaypalSearchView;
      if (query.view && query.view !== currentViewId) {
        console.log(`Navigating to query-specific view: ${queryView}`);
        await graylogHelper.loginAndVisitSearchView(queryView);
        await page.waitForLoadState('domcontentloaded');
        await graylogHelper.selectTimeRange(fromTime, toTime);
        currentViewId = queryView;
      }

      // Execute query using Graylog API client and wait for results (grouped by GROUP_BY_COLUMN)
      let groupedData: any[] = [];
      let totalCount: number = 0;
      try {
        console.log(`\nExecuting grouped query via API...`);
        const streamIds = config.graylogUserFlowStream ? [config.graylogUserFlowStream] : undefined;
        const apiResult = await graylogApi.executeCountAndGroupBy1ColumnQueryByStreamIdsAndWait(
          query.query,
          fromTimeISO,
          toTimeISO,
          GROUP_BY_COLUMN,
          streamIds
        );
        groupedData = apiResult.groupedData;
        totalCount = groupedData.reduce((sum, item) => sum + (item.count || 0), 0);
        console.log(`API Query Total Count: ${totalCount}`);
      } catch (error) {
        console.error(`Error executing query via API:`, error);
        // Continue with UI-based execution even if API fails
      }

      // Enter the search query and submit
      // The function will automatically submit (press Enter) and wait for the API response
      await graylogHelper.enterQueryText(query.query);

      // Take a screenshot for this query result (one screenshot for all grouped data)
      const screenshotFilename = `query-${i + 1}-result.png`;
      const screenshotPath = path.join(resultsDir, screenshotFilename);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Screenshot saved: ${screenshotPath}`);

      // Store result with field types (screenshot will be updated with S3 URL after upload)
      // Store groupedData as JSON object (will be properly serialized when writing to JSON file)
      results.push({
        name: { type: 'text', value: query.name },
        total: { type: 'text', value: totalCount },
        groupedData: { type: 'text', value: groupedData },
        queryIndex: { type: 'text', value: i + 1 },
        screenshot: { type: 'image', value: screenshotFilename }
      });
    }

    // Step 5: Upload results folder to S3 with custom prefix
    let s3BaseUrl = '';
    let s3Path = '';
    try {
      console.log(`\nUploading results folder to S3...`);
      const s3Prefix = config.s3Prefix || '';
      await uploadFolderToS3(resultsDir, `${s3Prefix}/paypal`);
      const fullPrefix = s3Prefix ? `${s3Prefix}/paypal` : 'paypal';
      s3Path = `s3://${config.s3Bucket}/${fullPrefix}/${datetimeFolder}`;
      
      // Build public S3 URL for screenshots using BASE_S3_URL from .env
      if (config.baseS3Url) {
        // Use BASE_S3_URL if provided, ensuring it ends with a slash
        const baseUrl = config.baseS3Url.endsWith('/') ? config.baseS3Url : `${config.baseS3Url}/`;
        s3BaseUrl = `${baseUrl}${fullPrefix}/${datetimeFolder}`;
      } else {
        // Fallback to manual construction if BASE_S3_URL is not set
        if (config.s3Endpoint) {
          // Custom endpoint (e.g., MinIO, DigitalOcean Spaces)
          if (config.s3ForcePathStyle) {
            s3BaseUrl = `${config.s3Endpoint}/${config.s3Bucket}/${fullPrefix}/${datetimeFolder}`;
          } else {
            s3BaseUrl = `${config.s3Endpoint}/${fullPrefix}/${datetimeFolder}`;
          }
        } else {
          // Standard AWS S3
          if (config.s3ForcePathStyle) {
            s3BaseUrl = `https://s3.${config.awsRegion}.amazonaws.com/${config.s3Bucket}/${fullPrefix}/${datetimeFolder}`;
          } else {
            s3BaseUrl = `https://${config.s3Bucket}.s3.${config.awsRegion}.amazonaws.com/${fullPrefix}/${datetimeFolder}`;
          }
        }
      }
      
      // Update screenshot values with public S3 URLs
      results.forEach((result) => {
        const screenshotFilename = result.screenshot.value;
        result.screenshot.value = `${s3BaseUrl}/${screenshotFilename}`;
      });
      
      console.log('Upload to S3 completed successfully');
    } catch (error) {
      console.error('Failed to upload to S3:', error);
      // Don't fail the test if S3 upload fails, just log the error
      // Screenshot values will remain as filenames
    }

    // Write results to JSON file (after S3 upload to include URLs)
    const jsonPath = path.join(resultsDir, 'results.json');
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    console.log(`\nResults written to: ${jsonPath}`);

    // Step 6: Send results to MS Teams
    if (config.msTeamWebhookUrl) {
      try {
        console.log(`\nSending results to MS Teams...`);
        
        // Build URLs array (S3 path if available)
        const urls: string[] = [];
        if (s3Path) {
          urls.push(s3Path);
        }

        const title = `Paypal Error Report - ${fromTime} to ${toTime}`;
        
        await buildAndSendGroup1ColumnAdaptiveCard(title, results, GROUP_BY_COLUMN, urls);
        console.log('Message sent to MS Teams successfully');
      } catch (error) {
        console.error('Failed to send message to MS Teams:', error);
        // Don't fail the test if MS Teams send fails, just log the error
      }
    } else {
      console.log('MS_TEAM_WEBHOOK_URL not configured, skipping MS Teams notification');
    }
  });
});

