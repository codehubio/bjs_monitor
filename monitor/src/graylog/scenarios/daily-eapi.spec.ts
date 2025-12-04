import { test, expect } from '@playwright/test';
import { GraylogHelper } from '../helper';
import { config } from '../../config';
import queries from '../searchText/daily-eapi';
import * as fs from 'fs';
import * as path from 'path';
import { uploadFolderToS3 } from '../../utils/uploadToS3';
import { buildAndSendAdaptiveCard } from '../../utils/sendToMsTeams';
import { GraylogApiService } from '../api.service';
import { buildDateTimeFolder, buildS3BaseUrl } from '../../utils/utils';
import { buildFailedPaymentBlock } from '../blocks/failed-payment.block';
import { buildEapiBlock } from '../blocks/eapi-block';


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
    
    if (successDiff > 200) {
      shouldNotify = true;
      reasons.push(`Successful orders (${successOrders}) is ${successDiff} lower than ${prev.date} (${prevSuccess})`);
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

function calculateMaxOrderNotification(
  currentDate: string,
  totalOrders: number,
  successOrders: number,
  orderData: Array<{ date: string; success: number; failed: number }>
): { notify: boolean; reason: string } {
  const reasons: string[] = [];
  let shouldNotify = false;

  // Condition 1: Check if total or success is in top 5% highest
  if (orderData.length > 0) {
    // Get all historical totals and successes
    const allTotals = orderData.map(item => item.success + item.failed).filter(v => v > 0);
    const allSuccesses = orderData.map(item => item.success).filter(v => v > 0);
    
    if (allTotals.length > 0 && allSuccesses.length > 0) {
      // Sort to find 95th percentile (top 5%)
      const sortedTotals = [...allTotals].sort((a, b) => a - b);
      const sortedSuccesses = [...allSuccesses].sort((a, b) => a - b);
      
      // Calculate 95th percentile index (95% of data, meaning top 5%)
      const percentile95Index = Math.max(0, Math.floor(sortedTotals.length * 0.95));
      const percentile95Total = sortedTotals[percentile95Index];
      const percentile95Success = sortedSuccesses[percentile95Index];
      
      // Check if current values are in top 5% highest
      if (totalOrders >= percentile95Total) {
        shouldNotify = true;
        reasons.push(`Total orders (${totalOrders}) is in top 5% highest (threshold: ${percentile95Total})`);
      }
      
      if (successOrders >= percentile95Success) {
        shouldNotify = true;
        reasons.push(`Successful orders (${successOrders}) is in top 5% highest (threshold: ${percentile95Success})`);
      }
    }
  }

  // Condition 2: Check if total or success is higher than 7 previous 7-day periods by more than 200
  const currentDateObj = new Date(currentDate);
  const previousPeriods: string[] = [];
  
  // Calculate dates for 7 previous 7-day periods (7, 14, 21, 28, 35, 42, 49 days ago)
  for (let daysAgo = 7; daysAgo <= 49; daysAgo += 7) {
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
    const totalDiff = totalOrders - prevTotal;
    const successDiff = successOrders - prevSuccess;
    
    if (totalDiff > 200) {
      shouldNotify = true;
      reasons.push(`Total orders (${totalOrders}) is ${totalDiff} higher than ${prev.date} (${prevTotal}), difference > 200`);
    }
    
    if (successDiff > 200) {
      shouldNotify = true;
      reasons.push(`Successful orders (${successOrders}) is ${successDiff} higher than ${prev.date} (${prevSuccess}), difference > 200`);
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
    const datetimeFolder = buildDateTimeFolder();
    const prefix =`daily-eapi/${datetimeFolder}`

    // Create results directory with datetime folder
    const resultsDir = path.resolve(process.cwd(), 'src','graylog','result', 'daily-eapi', datetimeFolder);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    // Array to store results (before S3 upload, screenshots are just filenames)
    const results: any [][]= [];
    const eapiBlock = await buildEapiBlock(page, fromTime, toTime, prefix);
    results.push([{'EAPI Report':{ type: 'separator' }}]);  
    results.push(eapiBlock);

    // Step 2: Verify we're on the search view page (not login page)
    
    const submitOrderQuery = queries[6] as any;
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
    
    // Calculate success/failed, minOrderNotification, and maxOrderNotification, then update order_data.json
    try {
      // Extract date from fromTime (format: 'YYYY-MM-DD HH:mm:ss' -> 'YYYY-MM-DD')
      const dateFromTime = fromTime.split(' ')[0]; // Extract date part
      
      // Get successful and failed orders from groupedData
      // Successful orders have eapi_err_desc = "(Empty Value)"
      // Failed orders are all other entries in groupedData
      let totalSuccess = 0;
      let totalFailed = 0;
      
      if (groupedData && Array.isArray(groupedData) && groupedData.length > 0) {
        // Sum counts directly from grouped data
        groupedData.forEach((item) => {
          // Access values from structured format {type, value}
          const count = (item.count?.value ?? item.count) || 0;
          const errDesc = item.eapi_err_desc?.value ?? item.eapi_err_desc;
          
          // Successful orders have eapi_err_desc = "(Empty Value)"
          if (errDesc === "(Empty Value)") {
            totalSuccess += count;
          } else {
            // All other entries are failed orders
            totalFailed += count;
          }
        });
      }
      
      // Read existing order_data.json
      const orderDataPath = path.resolve(process.cwd(), 'src', 'data', 'order_data.json');
      let orderData: Array<{ date: string; success: number; failed: number }> = [];
      
      if (fs.existsSync(orderDataPath)) {
        const existingData = fs.readFileSync(orderDataPath, 'utf-8');
        orderData = JSON.parse(existingData);
      }
      
      // Calculate minOrderNotification and maxOrderNotification before updating order_data.json
      const totalOrders = totalSuccess + totalFailed;
      minOrderNotification = calculateMinOrderNotification(
        dateFromTime,
        totalOrders,
        totalSuccess,
        orderData
      );
      
      maxOrderNotification = calculateMaxOrderNotification(
        dateFromTime,
        totalOrders,
        totalSuccess,
        orderData
      );
      
      console.log(`\nMin Order Notification:`, JSON.stringify(minOrderNotification, null, 2));
      console.log(`\nMax Order Notification:`, JSON.stringify(maxOrderNotification, null, 2));
      
      // Find or create entry for this date
      const existingIndex = orderData.findIndex(item => item.date === dateFromTime);
      
      if (existingIndex >= 0) {
        // Update existing entry
        orderData[existingIndex].success = totalSuccess;
        orderData[existingIndex].failed = totalFailed;
        console.log(`\nUpdated order_data.json for date ${dateFromTime}: success=${totalSuccess}, failed=${totalFailed}`);
      } else {
        // Add new entry (keep sorted by date)
        orderData.push({
          date: dateFromTime,
          success: totalSuccess,
          failed: totalFailed
        });
        // Sort by date
        orderData.sort((a, b) => a.date.localeCompare(b.date));
        console.log(`\nAdded new entry to order_data.json for date ${dateFromTime}: success=${totalSuccess}, failed=${totalFailed}`);
      }
      
      // Write updated data back to file
      fs.writeFileSync(orderDataPath, JSON.stringify(orderData, null, 2));
      console.log(`Order data written to: ${orderDataPath}`);
    } catch (error) {
      console.error('Failed to update order_data.json:', error);
      // Don't fail the test if order_data.json update fails
    }
    
      // Enter the search query and submit
      // The function will automatically submit (press Enter) and wait for the API response
    await graylogHelper.enterQueryText(submitOrderQuery.query);

    // Take a screenshot for this query result (one screenshot for all grouped data)
    const screenshotFilenameSubmitOrder = `query-${7}-result.png`;
    const screenshotPathSubmitOrder = path.join(resultsDir, screenshotFilenameSubmitOrder);
    await page.screenshot({ path: screenshotPathSubmitOrder, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPathSubmitOrder}`);
    // Add to arrays for new format
    results.push([{screenshot: { type: 'image', value: buildS3BaseUrl(config.s3Prefix, prefix, screenshotFilenameSubmitOrder) }}]);
    results.push([{
      name: { type: 'text', value: submitOrderQuery.name },
      total: { type: 'text', value: totalCount }
    }]);
    
    // Add notifications as tables if present (convert to table format)
    if (minOrderNotification) {
      results.push([{
        Name: { type: 'text', value: 'minOrderNotification' },
        Notify: { type: 'text', value: minOrderNotification.notify },
        Reason: { type: 'text', value: minOrderNotification.reason }
      }]);
    }
    if (maxOrderNotification) {
      results.push([{
        Name: { type: 'text', value: 'maxOrderNotification' },
        Notify: { type: 'text', value: maxOrderNotification.notify },
        Reason: { type: 'text', value: maxOrderNotification.reason }
      }]);
    }
    
    results.push(groupedData);
   
    
    const failedOrderQuery = queries[7] as any;
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
    const screenshotFilenameFailedOrder = `query-${7}-result.png`;
    const screenshotPathFailedOrder = path.join(resultsDir, screenshotFilenameFailedOrder);
    await page.screenshot({ path: screenshotPathFailedOrder, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPathFailedOrder}`);
    // Add to arrays for new format
    results.push([{
      name: { type: 'text', value: failedOrderQuery.name },
      total: { type: 'text', value: totalCount }
    }]);
    results.push([{screenshot: { type: 'image', value: buildS3BaseUrl(config.s3Prefix, prefix, screenshotFilenameFailedOrder) }}]);
    results.push(groupedDataFailedOrder);
    
    const paypalQuery = queries[8] as any;
    await graylogHelper.loginAndVisitSearchView(paypalQuery.view);
    await graylogHelper.selectTimeRange(fromTime, toTime);






    results.push([{'PAYPAL Report':{ type: 'separator' }}]);  
    let groupedDataPaypal: any[] = [];
    let totalCountPaypal: number = 0;
    try {
      const apiResult = await graylogApi.executeCountAndGroupBy1ColumnQueryByStreamIdsAndWait(
        paypalQuery.query,
        fromTimeISO,
        toTimeISO,
        paypalQuery.groupBy[0],
        [config.graylogUserFlowStream]
      );
      // Transform groupedData to structured format with type and value
      groupedDataPaypal = apiResult.groupedData.map((item: any) => {
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
      totalCountPaypal = apiResult.groupedData.reduce((sum: number, item: any) => sum + (item.count || 0), 0);
      console.log(`API Query Grouped  Results:`, groupedDataPaypal);
      console.log(`API Query Total Count: ${totalCountPaypal}`);
    } catch (error) {
      console.log(error);
    }
    console.log(`groupedData:`, JSON.stringify(groupedDataPaypal, null, 2));
      // Enter the search query and submit
      // The function will automatically submit (press Enter) and wait for the API response
    await graylogHelper.enterQueryText(paypalQuery.query);

    // Take a screenshot for this query result (one screenshot for all grouped data)
    const screenshotFilenamePaypal = `query-${8}-result.png`;
    const screenshotPathPaypal = path.join(resultsDir, screenshotFilenamePaypal);
    await page.screenshot({ path: screenshotPathPaypal, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPathPaypal}`);
    // Add to arrays for new format
    results.push([{
      name: { type: 'text', value: paypalQuery.name },
      total: { type: 'text', value: totalCountPaypal }
    }]);
    results.push([{screenshot: { type: 'image', value: buildS3BaseUrl(config.s3Prefix, prefix, screenshotFilenamePaypal) }}]);
    results.push(groupedDataPaypal);

    // const failedPaymentBlock = await buildFailedPaymentBlock(page, fromTime, toTime, prefix);
    // results.push(...failedPaymentBlock)




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

