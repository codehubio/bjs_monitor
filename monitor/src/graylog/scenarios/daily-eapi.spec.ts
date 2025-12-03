import { test, expect } from '@playwright/test';
import { GraylogHelper } from '../helper';
import { config } from '../../config';
import queries from '../searchText/daily-eapi';
import * as fs from 'fs';
import * as path from 'path';
import { uploadFolderToS3 } from '../../utils/uploadToS3';
import { buildAndSendAdaptiveCard } from '../../utils/sendToMsTeams';
import { GraylogApiService } from '../api.service';
import { buildS3BaseUrl } from '../../utils/utils';


function calculateMinOrderNotification(
  currentDate: string,
  totalOrders: number,
  successOrders: number,
  orderData: Array<{ date: string; success: number; failed: number }>
): { notify: boolean; reason: string } {
  const reasons: string[] = [];
  let shouldNotify = false;

  // Condition 1: Check if total or success is in top 10% lowest
  if (orderData.length > 0) {
    // Get all historical totals and successes
    const allTotals = orderData.map(item => item.success + item.failed).filter(v => v > 0);
    const allSuccesses = orderData.map(item => item.success).filter(v => v > 0);
    
    if (allTotals.length > 0 && allSuccesses.length > 0) {
      // Sort to find 10th percentile
      const sortedTotals = [...allTotals].sort((a, b) => a - b);
      const sortedSuccesses = [...allSuccesses].sort((a, b) => a - b);
      
      // Calculate 10th percentile index (10% of data)
      const percentile10Index = Math.max(0, Math.floor(sortedTotals.length * 0.1));
      const percentile10Total = sortedTotals[percentile10Index];
      const percentile10Success = sortedSuccesses[percentile10Index];
      
      // Check if current values are in top 10% lowest
      if (totalOrders <= percentile10Total) {
        shouldNotify = true;
        reasons.push(`Total orders (${totalOrders}) is in top 10% lowest (threshold: ${percentile10Total})`);
      }
      
      if (successOrders <= percentile10Success) {
        shouldNotify = true;
        reasons.push(`Successful orders (${successOrders}) is in top 10% lowest (threshold: ${percentile10Success})`);
      }
    }
  }

  // Condition 2: Check if total or success is lower than 4 previous 7-day periods by more than 200
  const currentDateObj = new Date(currentDate);
  const previousPeriods: string[] = [];
  
  // Calculate dates for 4 previous 7-day periods (7, 14, 21, 28 days ago)
  for (let daysAgo = 7; daysAgo <= 28; daysAgo += 7) {
    const previousDate = new Date(currentDateObj);
    previousDate.setDate(previousDate.getDate() - daysAgo);
    const previousDateStr = previousDate.toISOString().split('T')[0];
    previousPeriods.push(previousDateStr);
  }
  
  // Find data for previous periods
  const previousData = previousPeriods.map(date => {
    return orderData.find(item => item.date === date);
  }).filter(item => item !== undefined) as Array<{ date: string; success: number; failed: number }>;
  
  // Compare with each previous period
  previousData.forEach(prev => {
    const prevTotal = prev.success + prev.failed;
    const prevSuccess = prev.success;
    const totalDiff = prevTotal - totalOrders;
    const successDiff = prevSuccess - successOrders;
    
    if (totalDiff > 200) {
      shouldNotify = true;
      reasons.push(`Total orders (${totalOrders}) is ${totalDiff} lower than ${prev.date} (${prevTotal}), difference > 200`);
    }
    
    if (successDiff > 200) {
      shouldNotify = true;
      reasons.push(`Successful orders (${successOrders}) is ${successDiff} lower than ${prev.date} (${prevSuccess}), difference > 200`);
    }
  });

  // Build reason string
  let reason = '';
  if (shouldNotify) {
    reason = reasons.join('; ');
  } else {
    reason = 'No conditions met: Total and successful orders are within normal range';
  }

  return {
    notify: shouldNotify,
    reason: reason
  };
}
test.describe('Daily EAPI Search', () => {
  test('should login, report daily eapi, wait for results', async ({ page }) => {
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
    if (!config.graylogDailyEapiSearchView) {
      throw new Error('GRAYLOG_DAILY_EAPI_SEARCH_VIEW environment variable is not set');
    }

    // Step 1: Login if needed and visit the search view page
    await graylogHelper.loginAndVisitSearchView(config.graylogDailyEapiSearchView);

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
    const resultsDir = path.resolve(process.cwd(), 'src','graylog','result', 'daily-eapi', datetimeFolder);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    // Array to store results (before S3 upload, screenshots are just filenames)
    const results: any [][]= [];
    const singleQueryResults: any []= [];

    // Step 4: Loop through each query and execute the same task
    let currentViewId = config.graylogDailyEapiSearchView;
    const singleQueriesCount = 6;
    for (let i = 0; i < singleQueriesCount; i++) {
      const query = queries[i] as any;
      console.log(`\n=== Processing Query ${i + 1}/${queries.length} ===`);
      console.log('Query Name:', query.name);
      console.log('Query:', query.query);

      // Navigate to query-specific view if provided and different from current view
      const queryView = query.view || config.graylogDailyEapiSearchView;
      if (query.view && query.view !== currentViewId) {
        console.log(`Navigating to query-specific view: ${queryView}`);
        await graylogHelper.loginAndVisitSearchView(queryView);
        await graylogHelper.selectTimeRange(fromTime, toTime);
        currentViewId = queryView;
      }

      // Execute query using Graylog API client and wait for results
      let apiCount: number | null = null;
      try {
        console.log(`\nExecuting query via API...`);
        const streamIds = config.graylogEapiStream ? [config.graylogEapiStream] : undefined;
        const apiResult = await graylogApi.executeCountQueryByStreamIdsAndWait(query.query, fromTimeISO, toTimeISO, streamIds);
        apiCount = apiResult.count;
        console.log(`API Query Count: ${apiCount ?? 'N/A'}`);
      } catch (error) {
        console.error(`Error executing query via API:`, error);
        // Continue with UI-based execution even if API fails
      }

      // Enter the search query and submit
      // The function will automatically submit (press Enter) and wait for the API response
      await graylogHelper.enterQueryText(query.query);

      // Take a screenshot for this query result
      const screenshotFilename = `query-${i + 1}-result.png`;
      const screenshotPath = path.join(resultsDir, screenshotFilename);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Screenshot saved: ${screenshotPath}`);

      // Store result with field types (screenshot will be updated with S3 URL after upload)
      singleQueryResults.push({
        name: { type: 'text', value: query.name },
        total: { type: 'text', value: apiCount },
        screenshot: { type: 'image', value: buildS3BaseUrl(config.s3Prefix, 'daily-eapi', datetimeFolder, screenshotFilename) }
      });
    }
    results.push(singleQueryResults);


    // Step 2: Verify we're on the search view page (not login page)
    
    const submitOrderQuery = queries[singleQueriesCount] as any;
    await graylogHelper.loginAndVisitSearchView(submitOrderQuery.view);
    await graylogHelper.selectTimeRange(fromTime, toTime);
    let minOrderNotification: { notify: boolean; reason: string } | null = null;
    let maxOrderNotification: { notify: boolean; reason: string } | null = null;
    
    let groupedData: any[] = [];
    let totalCount: number = 0;
    try {
      const apiResult = await graylogApi.executeCountAndGroupBy1ColumnQueryByStreamIdsAndWait(
        submitOrderQuery.query,
        fromTimeISO,
        toTimeISO,
        submitOrderQuery.groupBy[0],
        [config.graylogEapiStream]
      );
      // Transform groupedData to structured format with type and value
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
      totalCount = apiResult.groupedData.reduce((sum: number, item: any) => sum + (item.count || 0), 0);
      console.log(`API Query Grouped Results:`, groupedData);
      console.log(`API Query Total Count: ${totalCount}`);
    } catch (error) {
      console.log(error);
    }
    console.log(`groupedData:`, JSON.stringify(groupedData, null, 2));
      // Enter the search query and submit
      // The function will automatically submit (press Enter) and wait for the API response
    await graylogHelper.enterQueryText(submitOrderQuery.query);

    // Take a screenshot for this query result (one screenshot for all grouped data)
    const screenshotFilenameSubmitOrder = `query-${singleQueriesCount + 1}-result.png`;
    const screenshotPathSubmitOrder = path.join(resultsDir, screenshotFilenameSubmitOrder);
    await page.screenshot({ path: screenshotPathSubmitOrder, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPathSubmitOrder}`);
    // Add to arrays for new format
    results.push([{screenshot: { type: 'image', value: buildS3BaseUrl(config.s3Prefix, 'daily-eapi', datetimeFolder, screenshotFilenameSubmitOrder) }}]);
    results.push([{
      name: { type: 'text', value: submitOrderQuery.name },
      total: { type: 'text', value: totalCount }
    }]);
    results.push(groupedData);
   
    
    const failedOrderQuery = queries[singleQueriesCount + 1] as any;
    await graylogHelper.loginAndVisitSearchView(failedOrderQuery.view);
    await graylogHelper.selectTimeRange(fromTime, toTime);
    let groupedDataFailedOrder: any[] = [];
    let totalCountFailedOrder: number = 0;
    try {
      const apiResult = await graylogApi.executeCountAndGroupBy4ColumnQueryByStreamIdsAndWait(
        failedOrderQuery.query,
        fromTimeISO,
        toTimeISO,
        failedOrderQuery.groupBy[0],
        failedOrderQuery.groupBy[1],
        failedOrderQuery.groupBy[2],
        failedOrderQuery.groupBy[3],
        [config.graylogEapiStream]
      );
      // Transform groupedData to structured format with type and value
      groupedDataFailedOrder = apiResult.groupedData.map((item: any) => {
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
      totalCount = apiResult.groupedData.reduce((sum: number, item: any) => sum + (item.count || 0), 0);
      console.log(`API Query Grouped Results:`, groupedDataFailedOrder);
      console.log(`API Query Total Count: ${totalCountFailedOrder}`);
    } catch (error) {
      console.log(error);
    }
    console.log(`groupedData:`, JSON.stringify(groupedDataFailedOrder, null, 2));
      // Enter the search query and submit
      // The function will automatically submit (press Enter) and wait for the API response
    await graylogHelper.enterQueryText(failedOrderQuery.query);

    // Take a screenshot for this query result (one screenshot for all grouped data)
    const screenshotFilenameFailedOrder = `query-${singleQueriesCount + 1}-result.png`;
    const screenshotPathFailedOrder = path.join(resultsDir, screenshotFilenameFailedOrder);
    await page.screenshot({ path: screenshotPathFailedOrder, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPathFailedOrder}`);
    // Add to arrays for new format
    results.push([{
      name: { type: 'text', value: submitOrderQuery.name },
      total: { type: 'text', value: totalCount }
    }]);
    results.push([{screenshot: { type: 'image', value: buildS3BaseUrl(config.s3Prefix, 'daily-eapi', datetimeFolder, screenshotFilenameFailedOrder) }}]);
    results.push(groupedDataFailedOrder);
    
    // Step 5: Upload results folder to S3 with custom prefix
    let s3Path = '';
    try {
      console.log(`\nUploading results folder to S3...`);
      const s3Prefix = config.s3Prefix || '';
      await uploadFolderToS3(resultsDir, `${s3Prefix}/daily-eapi`);
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

        const title = `Report status - ${fromTime} to ${toTime}`;
        
        // Pass results as array of arrays - wrap single array in another array
        // Headers will be automatically extracted from field names
        await buildAndSendAdaptiveCard(title, results, urls);
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

