import { Page } from '@playwright/test';
import { GraylogHelper } from '../helper';
import { config } from '../../config';
import queries from '../searchText/order';
import * as fs from 'fs';
import * as path from 'path';
import { GraylogApiService } from '../api.service';
import {  buildS3BaseUrl } from '../../utils/utils';


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

export async function buildOrderBlock(page: Page, fromTime: string, toTime: string, prefix: string) {
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
  if (!config.graylogDailyEapiSearchView) {
    throw new Error('GRAYLOG_DAILY_EAPI_SEARCH_VIEW environment variable is not set');
  }

  // Step 1: Login if needed and visit the search view page
  await graylogHelper.loginAndVisitSearchView(config.graylogDailyEapiSearchView);

  // Step 4: Click on the timerange type target div
  await graylogHelper.selectTimeRange(fromTime, toTime);

  // Array to store results (before S3 upload, screenshots are just filenames)
  const results: any [][]= [];

  // Step 2: Verify we're on the search view page (not login page)
  
  const submitOrderQuery = queries[0] as any;
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
  
  // Calculate success/failed, minOrderNotification, and maxOrderNotification, then update daily-stats.json
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
    
    // Read existing daily-stats.json
    const dailyStatsPath = path.resolve(process.cwd(), 'src', 'data', 'daily-stats.json');
    type DailyStatsEntry = { date: string; order: { success: number; failed: number }; [key: string]: any };
    let dailyStats: DailyStatsEntry[] = [];
    
    if (fs.existsSync(dailyStatsPath)) {
      const existingData = fs.readFileSync(dailyStatsPath, 'utf-8');
      const parsed = JSON.parse(existingData);
      
      // Handle migration: convert old formats to new structure
      if (Array.isArray(parsed)) {
        // Check if it's the old format with direct success/failed or new format with order object
        if (parsed.length > 0 && 'success' in parsed[0] && !('order' in parsed[0])) {
          // Old format: [{date, success, failed}]
          dailyStats = parsed.map((item: any) => ({
            date: item.date,
            order: {
              success: item.success,
              failed: item.failed
            }
          }));
        } else {
          // Already new format or empty array
          dailyStats = parsed;
        }
      } else if (parsed && typeof parsed === 'object' && parsed.order && Array.isArray(parsed.order)) {
        // Old format: {order: [{date, success, failed}]}
        dailyStats = parsed.order.map((item: any) => ({
          date: item.date,
          order: {
            success: item.success,
            failed: item.failed
          }
        }));
      } else {
        dailyStats = [];
      }
    }
    
    // Transform to format expected by notification functions
    const orderDataForNotifications = dailyStats.map(item => ({
      date: item.date,
      success: item.order.success,
      failed: item.order.failed
    }));
    
    // Calculate minOrderNotification and maxOrderNotification before updating daily-stats.json
    const totalOrders = totalSuccess + totalFailed;
    minOrderNotification = calculateMinOrderNotification(
      dateFromTime,
      totalOrders,
      totalSuccess,
      orderDataForNotifications
    );
    
    maxOrderNotification = calculateMaxOrderNotification(
      dateFromTime,
      totalOrders,
      totalSuccess,
      orderDataForNotifications
    );
    
    console.log(`\nMin Order Notification:`, JSON.stringify(minOrderNotification, null, 2));
    console.log(`\nMax Order Notification:`, JSON.stringify(maxOrderNotification, null, 2));
    
    // Find or create entry for this date
    const existingIndex = dailyStats.findIndex(item => item.date === dateFromTime);
    
    if (existingIndex >= 0) {
      // Update existing entry
      dailyStats[existingIndex].order.success = totalSuccess;
      dailyStats[existingIndex].order.failed = totalFailed;
      console.log(`\nUpdated daily-stats.json for date ${dateFromTime}: success=${totalSuccess}, failed=${totalFailed}`);
    } else {
      // Add new entry (keep sorted by date)
      dailyStats.push({
        date: dateFromTime,
        order: {
          success: totalSuccess,
          failed: totalFailed
        }
      });
      // Sort by date
      dailyStats.sort((a, b) => a.date.localeCompare(b.date));
      console.log(`\nAdded new entry to daily-stats.json for date ${dateFromTime}: success=${totalSuccess}, failed=${totalFailed}`);
    }
    
    // Write updated data back to file
    fs.writeFileSync(dailyStatsPath, JSON.stringify(dailyStats, null, 2));
    console.log(`Report stats written to: ${dailyStatsPath}`);
  } catch (error) {
    console.error('Failed to update daily-stats.json:', error);
    // Don't fail the test if daily-stats.json update fails
  }
  
    // Enter the search query and submit
    // The function will automatically submit (press Enter) and wait for the API response
  await graylogHelper.enterQueryText(submitOrderQuery.query);

  // Take a screenshot for this query result (one screenshot for all grouped data)
  const screenshotFilenameSubmitOrder = `query-order-1-result.png`;
  const screenshotPathSubmitOrder = path.join(resultDir, screenshotFilenameSubmitOrder);
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
 
  
  const failedOrderQuery = queries[1] as any;
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
  const screenshotFilenameFailedOrder = `query-order-2-result.png`;
  const screenshotPathFailedOrder = path.join(resultDir, screenshotFilenameFailedOrder);
  await page.screenshot({ path: screenshotPathFailedOrder, fullPage: true });
  console.log(`Screenshot saved: ${screenshotPathFailedOrder}`);
  // Add to arrays for new format
  results.push([{
    name: { type: 'text', value: failedOrderQuery.name },
    total: { type: 'text', value: totalCount }
  }]);
  results.push([{screenshot: { type: 'image', value: buildS3BaseUrl(config.s3Prefix, prefix, screenshotFilenameFailedOrder) }}]);
  results.push(groupedDataFailedOrder);
  return results
}

    