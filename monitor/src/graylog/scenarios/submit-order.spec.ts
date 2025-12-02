import { test, expect } from '@playwright/test';
import { GraylogHelper } from '../helper';
import { config } from '../../config';
import queries, { GROUP_BY_COLUMN } from '../searchText/submit-order';
import * as fs from 'fs';
import * as path from 'path';
import { uploadFolderToS3 } from '../../utils/uploadToS3';
import { buildAndSendGroup1ColumnAdaptiveCard } from '../../utils/sendToMsTeams';
import { GraylogApiService } from '../api.service';

/**
 * Calculate minOrderNotification based on order data
 * @param currentDate Current date in YYYY-MM-DD format
 * @param totalOrders Total orders (success + failed)
 * @param successOrders Successful orders
 * @param orderData Array of historical order data
 * @returns Notification object with notify and reason
 */
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

/**
 * Calculate maxOrderNotification based on order data
 * @param currentDate Current date in YYYY-MM-DD format
 * @param totalOrders Total orders (success + failed)
 * @param successOrders Successful orders
 * @param orderData Array of historical order data
 * @returns Notification object with notify and reason
 */
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

test.describe('Submit Order Search', () => {
  test('should login, report submit order, wait for results', async ({ page }) => {
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
    if (!config.graylogSubmitOrderSearchView) {
      throw new Error('GRAYLOG_SUBMIT_ORDER_SEARCH_VIEW environment variable is not set');
    }

    // Step 1: Login if needed and visit the search view page
    await graylogHelper.loginAndVisitSearchView(config.graylogSubmitOrderSearchView);

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
    const resultsDir = path.resolve(process.cwd(), 'src','graylog','result', 'submit-order', datetimeFolder);
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
      description?: { type: string; value: string };
      minOrderNotification?: { type: string; value: { notify: boolean; reason: string } };
      maxOrderNotification?: { type: string; value: { notify: boolean; reason: string } };
    }> = [];

    // Step 4: Loop through each query and execute the same task
    let currentViewId = config.graylogSubmitOrderSearchView;
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i] as any;
      console.log(`\n=== Processing Query ${i + 1}/${queries.length} ===`);
      console.log('Query Name:', query.name);
      console.log('Query:', query.query);

      // Navigate to query-specific view if provided and different from current view
      const queryView = query.view || config.graylogSubmitOrderSearchView;
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
        const streamIds = config.graylogEapiStream ? [config.graylogEapiStream] : undefined;
        const apiResult = await graylogApi.executeCountAndGroupBy1ColumnQueryByStreamIdsAndWait(
          query.query,
          fromTimeISO,
          toTimeISO,
          GROUP_BY_COLUMN,
          streamIds
        );
        groupedData = apiResult.groupedData;
        totalCount = groupedData.reduce((sum, item) => sum + (item.count || 0), 0);
        console.log(`API Query Grouped Results:`, groupedData);
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
      await uploadFolderToS3(resultsDir, `${s3Prefix}/submit-order`);
      const fullPrefix = s3Prefix ? `${s3Prefix}/submit-order` : 'submit-order';
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

    // Step 6: Calculate success/failed, minOrderNotification, and maxOrderNotification, then update order_data.json
    let minOrderNotification: { notify: boolean; reason: string } | null = null;
    let maxOrderNotification: { notify: boolean; reason: string } | null = null;
    
    try {
      // Extract date from fromTime (format: 'YYYY-MM-DD HH:mm:ss' -> 'YYYY-MM-DD')
      const dateFromTime = fromTime.split(' ')[0]; // Extract date part
      
      // Get successful and failed orders from results
      // Successful orders have eapi_err_desc = "(Empty Value)"
      // Failed orders are all other entries in groupedData
      let totalSuccess = 0;
      let totalFailed = 0;
      
      if (results.length > 0) {
        const firstResult = results[0];
        const groupedData = firstResult.groupedData.value as any[];
        
        if (groupedData && Array.isArray(groupedData)) {
          // Sum counts directly from grouped data
          groupedData.forEach((item) => {
            const count = item.count || 0;
            const errDesc = item.eapi_err_desc;
            
            // Successful orders have eapi_err_desc = "(Empty Value)"
            if (errDesc === "(Empty Value)") {
              totalSuccess += count;
            } else {
              // All other entries are failed orders
              totalFailed += count;
            }
          });
        }
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

    // // Add minOrderNotification and maxOrderNotification to results
    // if (minOrderNotification) {
    //   results.push({
    //     name: { type: 'text', value: 'minOrderNotification' },
    //     total: { type: 'text', value: null },
    //     groupedData: { type: 'text', value: null },
    //     queryIndex: { type: 'text', value: 0 },
    //     screenshot: { type: 'image', value: '' },
    //     minOrderNotification: { type: 'text', value: minOrderNotification }
    //   });
    // }
    
    // if (maxOrderNotification) {
    //   results.push({
    //     name: { type: 'text', value: 'maxOrderNotification' },
    //     total: { type: 'text', value: null },
    //     groupedData: { type: 'text', value: null },
    //     queryIndex: { type: 'text', value: 0 },
    //     screenshot: { type: 'image', value: '' },
    //     maxOrderNotification: { type: 'text', value: maxOrderNotification }
    //   });
    // }

    // Write results to JSON file (after S3 upload and notification calculation)
    const jsonPath = path.join(resultsDir, 'results.json');
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    console.log(`\nResults written to: ${jsonPath}`);

    // Step 7: Combine notification text and add to description field before sending to MS Teams
    if (results.length > 0) {
      const descriptionParts: string[] = [];
      
      if (minOrderNotification && minOrderNotification.notify) {
        descriptionParts.push(`Min Order Alert: ${minOrderNotification.reason}`);
      }
      
      if (maxOrderNotification && maxOrderNotification.notify) {
        descriptionParts.push(`Max Order Alert: ${maxOrderNotification.reason}`);
      }
      
      // Add description to the first result if there's any notification text
      if (descriptionParts.length > 0) {
        results[0].description = { type: 'text', value: descriptionParts.join('\n\n') };
      }
    }

    // Step 8: Send results to MS Teams
    if (config.msTeamWebhookUrl) {
      try {
        console.log(`\nSending results to MS Teams...`);
        
        // Build URLs array (S3 path if available)
        const urls: string[] = [];
        if (s3Path) {
          urls.push(s3Path);
        }

        const title = `Submit Order Report - ${fromTime} to ${toTime}`;
        
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

