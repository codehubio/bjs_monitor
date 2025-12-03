import { GraylogHelper } from '../helper';
import { config } from '../../config';
import queries, { GROUP_BY_COLUMN_1, GROUP_BY_COLUMN_2, GROUP_BY_COLUMN_3 } from '../searchText/failed-payment';
import * as fs from 'fs';
import * as path from 'path';
import { GraylogApiService } from '../api.service';
import { buildDateTimeFolder, buildS3BaseUrl } from '../../utils/utils';
import { Page } from '@playwright/test';
export async function buildFailedPaymentBlock(page: Page, fromTime: string, toTime: string, prefix: string) {
  const graylogHelper = new GraylogHelper(page);
  const graylogApi = new GraylogApiService();

  // Check if time range is configured
  if (!config.graylogQueryFromTime || !config.graylogQueryToTime) {
    throw new Error('GRAYLOG_QUERY_FROM_TIME and GRAYLOG_QUERY_TO_TIME environment variables must be set');
  }
  const pathElements = prefix.split('/');
  const resultDir = path.resolve(process.cwd(), 'src','graylog','result', pathElements[0], pathElements[1]);
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
  // Note: This config property may need to be added to config.ts
  const searchViewId = (config as any).graylogFailedPaymentSearchView || config.graylogSubmitOrderSearchView;
  if (!searchViewId) {
    throw new Error('GRAYLOG_FAILED_PAYMENT_SEARCH_VIEW or GRAYLOG_SUBMIT_ORDER_SEARCH_VIEW environment variable is not set');
  }

  // Step 1: Login if needed and visit the search view page
  await graylogHelper.loginAndVisitSearchView(searchViewId);
  // Step 4: Click on the timerange type target div
  await graylogHelper.selectTimeRange(fromTime, toTime);

  // Generate datetime string in format dd-mm-yy-hh-MM
  const datetimeFolder = buildDateTimeFolder();
  const folderPrefix='daily-eapi'
  // Create results directory with datetime folder

  // Array to store results (before S3 upload, screenshots are just filenames)
  const results: any[][] = [];

  // Step 4: Loop through each query and execute the same task
  let currentViewId = searchViewId;
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i] as any;
    console.log(`\n=== Processing Query ${i + 1}/${queries.length} ===`);
    console.log('Query Name:', query.name);
    console.log('Query:', query.query);

    // Navigate to query-specific view if provided and different from current view
    const queryView = query.view || searchViewId;
    if (query.view && query.view !== currentViewId) {
      console.log(`Navigating to query-specific view: ${queryView}`);
      await graylogHelper.loginAndVisitSearchView(queryView);
      await page.waitForLoadState('domcontentloaded');
      await graylogHelper.selectTimeRange(fromTime, toTime);
      currentViewId = queryView;
    }

    // Execute query using Graylog API client and wait for results (grouped by 3 columns)
    let groupedData: any[] = [];
    let totalCount: number = 0;
    try {
      console.log(`\nExecuting grouped query via API (3 columns)...`);
      const streamIds = config.graylogEapiStream ? [config.graylogEapiStream] : undefined;
      const apiResult = await graylogApi.executeCountAndGroupBy3ColumnQueryByStreamIdsAndWait(
        query.query,
        fromTimeISO,
        toTimeISO,
        GROUP_BY_COLUMN_1,
        GROUP_BY_COLUMN_2,
        GROUP_BY_COLUMN_3,
        streamIds
      );
      groupedData = apiResult.groupedData.map((item: any) => {
        const transformedItem: any = {};
        // Transform each field in the item to {type, value} format
        for (const key in item) {
          if (item.hasOwnProperty(key)) {
            transformedItem[key] = {
              type: 'text',
              value: item[key]
            };
          }
        }
        return transformedItem;
      });
      totalCount = groupedData.reduce((sum, item) => sum + (item.count || 0), 0);
      console.log(`API Query Grouped Results (3 columns):`, groupedData);
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
    const screenshotPath = path.join(resultDir, screenshotFilename);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Store result with field types (screenshot will be updated with S3 URL after upload)
    // Store groupedData as JSON object (will be properly serialized when writing to JSON file)
    results.push([{screenshot: { type: 'image', value: buildS3BaseUrl(config.s3Prefix, prefix, screenshotFilename) }}]);
    results.push(groupedData);
  }
  return results;
}
  