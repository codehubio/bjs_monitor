import { GraylogHelper } from '../helper';
import { config } from '../../config';
import queries from '../searchText/payment';
import * as path from 'path';
import { GraylogApiService } from '../api.service';
import { buildS3BaseUrl } from '../../utils/utils';
import { Page } from '@playwright/test';
export async function buildPaymentBlock(page: Page, fromTime: string, toTime: string, prefix: string) {
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
  

  // Array to store results (before S3 upload, screenshots are just filenames)
  const results: any[][] = [];
  let baseCount: number = 0;
  // Step 4: Loop through each query and execute the same task
  const singleCountPaymentQueries = [queries[0], queries[1]] as any;
  for (let i = 0; i< singleCountPaymentQueries.length; ++i) {
    const query =singleCountPaymentQueries[i]
    console.log('Query Name:', query.name);
    console.log('Query:', query.query);
    await graylogHelper.loginAndVisitSearchView(query.view);
    // Step 4: Click on the timerange type target div
    await graylogHelper.selectTimeRange(fromTime, toTime);
    
    // Navigate to query-specific view if provided and different from current view
    console.log(`Navigating to query-specific view: ${query.view}`);
    await graylogHelper.loginAndVisitSearchView(query.view);
    await page.waitForLoadState('domcontentloaded');
    await graylogHelper.selectTimeRange(fromTime, toTime);
  
    // Execute query using Graylog API client and wait for results (grouped by 3 columns)
    let apiCount: number | null = null;
    try {
      console.log(`\nExecuting grouped query via API (3 columns)...`);
      const streamIds = config.graylogEapiStream ? [config.graylogEapiStream] : undefined;
      const apiResult = await graylogApi.executeCountQueryByStreamIdsAndWait(
        query.query,
        fromTimeISO,
        toTimeISO,
        streamIds
      );
      apiCount = apiResult.count;
    } catch (error) {
      console.error(`Error executing query via API:`, error);
      // Continue with UI-based execution even if API fails
    }
  
    // Enter the search query and submit
    // The function will automatically submit (press Enter) and wait for the API response
    await graylogHelper.enterQueryText(query.query);
  
    // Take a screenshot for this query result (one screenshot for all grouped data)
    const screenshotFilename = `query-payment-${++baseCount}-result.png`;
    const screenshotPath = path.join(resultDir, screenshotFilename);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  
    // Store result with field types (screenshot will be updated with S3 URL after upload)
    // Store groupedData as JSON object (will be properly serialized when writing to JSON file)
    results.push([{name: { type: 'text', value: query.name },
      total: { type: 'text', value: apiCount },screenshot: { type: 'image', value: buildS3BaseUrl(config.s3Prefix, prefix, screenshotFilename) }}]);
  }
  // Step 4: Loop through each query and execute the same task
  const groupPaymentQueries = [queries[2], queries[3]] as any;
  for (let i = 0; i< groupPaymentQueries.length; ++i) {
    const query =groupPaymentQueries[i]
    console.log('Query Name:', query.name);
    console.log('Query:', query.query);
    await graylogHelper.loginAndVisitSearchView(query.view);
    // Step 4: Click on the timerange type target div
    await graylogHelper.selectTimeRange(fromTime, toTime);
    
    // Navigate to query-specific view if provided and different from current view
    console.log(`Navigating to query-specific view: ${query.view}`);
    await graylogHelper.loginAndVisitSearchView(query.view);
    await page.waitForLoadState('domcontentloaded');
    await graylogHelper.selectTimeRange(fromTime, toTime);
  
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
        query.groupBy[0],
        query.groupBy[1],
        query.groupBy[2],
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
    const screenshotFilename = `query-payment-${++baseCount}-result.png`;
    const screenshotPath = path.join(resultDir, screenshotFilename);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  
    // Store result with field types (screenshot will be updated with S3 URL after upload)
    // Store groupedData as JSON object (will be properly serialized when writing to JSON file)
    results.push([{screenshot: { type: 'image', value: buildS3BaseUrl(config.s3Prefix, prefix, screenshotFilename) }}]);
    results.push(groupedData);
  }
  return results;
}
  