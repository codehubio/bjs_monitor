import {
  Page
} from '@playwright/test';
import {
  GraylogHelper
} from '../helper';
import {
  config
} from '../../config';
import queries from '../searchText/daily-summary';
import * as path from 'path';
import * as fs from 'fs';
import {
  GraylogApiService
} from '../api.service';
import {
  buildS3BaseUrl,
  parseUTCTime,
  mergeToDailySummary,
  calculateMaxOrderNotification,
  calculateMinOrderNotification
} from '../../utils/utils';

export async function buildSummayBlock(page: Page, fromTime: string, toTime: string, prefix: string, takingScreenshot: boolean = config.graylogTakingScreenshot) {
  const graylogHelper = new GraylogHelper(page);
  const graylogApi = new GraylogApiService();

  // Check if time range is configured
  if (!config.graylogQueryFromTime || !config.graylogQueryToTime) {
    throw new Error('GRAYLOG_QUERY_FROM_TIME and GRAYLOG_QUERY_TO_TIME environment variables must be set');
  }
  const pathElements = prefix.split('/');
  const resultDir = path.resolve(process.cwd(), 'src', 'graylog', 'result', pathElements[0], pathElements[1]);
  // Convert time strings (UTC format: 'YYYY-MM-DD HH:mm:ss') to ISO format for API calls
  // Parse as UTC explicitly to avoid timezone conversion issues
  const fromTimeISO = parseUTCTime(fromTime, -8);
  const toTimeISO = parseUTCTime(toTime, -8);
  // Check if search view ID is configured
  if (!config.graylogDailyEapiSearchView) {
    throw new Error('GRAYLOG_DAILY_EAPI_SEARCH_VIEW environment variable is not set');
  }

  // Array to store results (before S3 upload, screenshots are just filenames)
  const singleQueryResults: any[] = [];
  await page.waitForTimeout(3000);
  console.log(`Total queries: ${queries.length}`);
  // Step 4: Loop through each query and execute the same task
  for (let i = 0; i < queries.length; i++) {
    const {
      query,
      stream,
      name,
      view
    } = queries[i] as any;
    console.log(`\n=== Processing Query ${i + 1}/${queries.length} ===`);
    console.log('Query Name:', name);
    console.log('Query:', query);

    // Execute query using Graylog API client and wait for results
    let apiCount: number | null = null;
    try {
      console.log(`\nExecuting query via API...`);
      const apiResult = await graylogApi.executeCountQueryByStreamIdsAndWait(query, fromTimeISO, toTimeISO, stream ? [stream] : []);
      apiCount = apiResult.count;
      console.log(`API Query Count: ${apiCount ?? 'N/A'}`);
    } catch (error) {
      console.error(`Error executing query via API:`, error);
      // Continue with UI-based execution even if API fails
    }

    // Login, visit search view, select time range, enter query, wait, and take screenshot (if takingScreenshot is true)
    const screenshotFilename = `query-eapi-${i + 1}-result.png`;
    const screenshotPath = path.join(resultDir, screenshotFilename);
    if (takingScreenshot) {
      await graylogHelper.loginVisitSelectTimeEnterQueryWaitAndScreenshot(
        view,
        fromTime,
        toTime,
        query,
        screenshotPath
      );
    }

    // Store result with field types (screenshot will be updated with S3 URL after upload)
    singleQueryResults.push([{
      name: {
        type: 'text',
        value: name
      },
      total: {
        type: 'text',
        value: apiCount
      },
      screenshot: {
        type: 'image',
        value: takingScreenshot ? buildS3BaseUrl(config.s3Prefix, prefix, screenshotFilename) : 'Not Available'
      }
    }]);
  }

  // Write stats data to daily-summary.json
  try {
    // Extract date from fromTime (format: 'YYYY-MM-DD HH:mm:ss' -> 'YYYY-MM-DD')
    const dateFromTime = fromTime.split(' ')[0];
    
    // Extract all query results into a structured object
    const statsData: any = {
      date: dateFromTime
    };
    
    // Extract counts from query results
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i] as any;
      const result = singleQueryResults[i]?.[0];
      const count = result?.total?.value;
      
      if (count !== null && count !== undefined) {
        // Convert to number, handling both number and string types
        let numericCount: number;
        if (typeof count === 'number') {
          numericCount = count;
        } else {
          const parsed = parseInt(String(count), 10);
          numericCount = isNaN(parsed) ? 0 : parsed;
        }
        
        // Only add if we have a valid number
        if (!isNaN(numericCount)) {
          // Map query names to stats data structure
          switch (query.name) {
            case "Total EAPI calls":
              statsData.totalEapis = numericCount;
              break;
            case "Total HTTP-error non 5xx EAPIs":
              statsData.httpErrorNon5xx = numericCount;
              break;
            case "Total HTTP-error 5xx EAPIs":
              statsData.httpError5xx = numericCount;
              break;
            case "Total socket hang up errors":
              statsData.socketHangUpErrors = numericCount;
              break;
            case "Total Cronjob EAPI calls":
              statsData.cronjobEapis = numericCount;
              break;
            case "Total EAPI of which duration > 10 seconds":
              statsData.eapiDurationOver10Seconds = numericCount;
              break;
            case "Total successful orders":
              statsData.successfulOrders = numericCount;
              break;
            case "Total failed orders":
              statsData.failedOrders = numericCount;
              break;
            case "Total successful mobile payments":
              statsData.successfulMobilePayments = numericCount;
              break;
            case "Total failed mobile payments":
              statsData.failedMobilePayments = numericCount;
              break;
            case "Total success BJS online payments":
              statsData.successfulBjsOnlinePayments = numericCount;
              break;
            case "Total failed BJS online payments":
              statsData.failedBjsOnlinePayments = numericCount;
              break;
            case `Total "Succesful Paypal but Failed SubmitOrder"`:
              statsData.successfulPaypalButFailedSubmitOrder = numericCount;
              break;
            case `Total orders submitted with paypal (APPROVE_PAYPAL_PAYMENT`:
              statsData.successfulPaypal = numericCount;
              break;
            case `Total failure mobile paypal (ERR_PAYPAL_PAYMENT_PAGE_LOAD_MP/ERR_PAYPAL_PAYMENT_VALIDATION_MP/ERR_PAYPAL_PAYMENT_EAPI_MP)`:
              statsData.failedMobilePaypal = numericCount;
              break;
            case `Total failure BJS online paypal (ERR_PAYPAL_PAYMENT_PAGE_LOAD/ERR_PAYPAL_PAYMENT_VALIDATION/ERR_PAYPAL_PAYMENT_EAPI)`:
              statsData.failedBjsOnlinePaypal = numericCount;
              break;
            case "Total open check":
              statsData.openCheck = numericCount;
              break;
          }
        }
      }
    }
    
    // Use the helper function to merge and write to daily-summary.json
    mergeToDailySummary(statsData);
  } catch (error) {
    console.error('Failed to write daily-summary.json:', error);
    // Don't fail the test if daily-summary.json write fails
  }

  // Calculate notification for "Total successful orders" and update the label
  try {
    const dateFromTime = fromTime.split(' ')[0];
    const successfulOrdersIndex = queries.findIndex((q: any) => q.name === "Total successful orders");
    
    if (successfulOrdersIndex >= 0) {
      const successfulOrdersResult = singleQueryResults[successfulOrdersIndex]?.[0];
      const successfulOrdersCount = successfulOrdersResult?.total?.value;
      
      if (successfulOrdersCount !== null && successfulOrdersCount !== undefined) {
        // Convert to number
        let numericSuccessfulOrders: number;
        if (typeof successfulOrdersCount === 'number') {
          numericSuccessfulOrders = successfulOrdersCount;
        } else {
          const parsed = parseInt(String(successfulOrdersCount), 10);
          numericSuccessfulOrders = isNaN(parsed) ? 0 : parsed;
        }
        
        // Get failed orders count for total calculation
        const failedOrdersIndex = queries.findIndex((q: any) => q.name === "Total failed orders");
        const failedOrdersResult = failedOrdersIndex >= 0 ? singleQueryResults[failedOrdersIndex]?.[0] : null;
        const failedOrdersCount = failedOrdersResult?.total?.value;
        
        let numericFailedOrders: number = 0;
        if (failedOrdersCount !== null && failedOrdersCount !== undefined) {
          if (typeof failedOrdersCount === 'number') {
            numericFailedOrders = failedOrdersCount;
          } else {
            const parsed = parseInt(String(failedOrdersCount), 10);
            numericFailedOrders = isNaN(parsed) ? 0 : parsed;
          }
        }
        
        const totalOrders = numericSuccessfulOrders + numericFailedOrders;
        
        // Calculate both min and max notifications
        const maxNotification = calculateMaxOrderNotification(
          dateFromTime,
          totalOrders,
          numericSuccessfulOrders
        );
        const minNotification = calculateMinOrderNotification(
          dateFromTime,
          totalOrders,
          numericSuccessfulOrders
        );
        
        // Update the label to show notification result
        // Priority: min notification (low orders) takes precedence over max notification
        const currentName = successfulOrdersResult.name.value;
        let updatedName = currentName;
        
        if (minNotification.notify) {
          updatedName = `${currentName} - ⚠️ MIN ALERT: ${minNotification.reason}`;
          console.log(`\n⚠️ MIN Notification triggered for Total successful orders: ${minNotification.reason}`);
        } else if (maxNotification.notify) {
          updatedName = `${currentName} - ⚠️ MAX ALERT: ${maxNotification.reason}`;
          console.log(`\n⚠️ MAX Notification triggered for Total successful orders: ${maxNotification.reason}`);
        } else {
          // Show both reasons even if neither triggers, but without warning emoji
          updatedName = `${currentName} - MIN: ${minNotification.reason}; MAX: ${maxNotification.reason}`;
          console.log(`\nNotification calculated for Total successful orders - MIN: ${minNotification.reason}; MAX: ${maxNotification.reason}`);
        }
        
        successfulOrdersResult.name.value = updatedName;
      }
    }
  } catch (error) {
    console.error('Failed to calculate order notification:', error);
    // Don't fail if notification calculation fails
  }

  return singleQueryResults
}