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
  parseUTCTime
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
        const numericCount = typeof count === 'number' ? count : parseInt(String(count), 10);
        
        // Map query names to stats data structure
        switch (query.name) {
          case "Total EAPIs":
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
          case "Total Cronjob EAPIs":
            statsData.cronjobEapis = numericCount;
            break;
          case "Total EAPI of whichduration > 10 seconds":
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
          case "Total success desktop payments":
            statsData.successfulDesktopPayments = numericCount;
            break;
          case "Total failed desktop payments":
            statsData.failedDesktopPayments = numericCount;
            break;
          case `Total "Succesful Paypal but Failed SubmitOrder"`:
            statsData.successfulPaypalButFailedSubmitOrder = numericCount;
            break;
          case `Total succesful paypal (COMPLETE_PAYPAL_PAYMENT/APPROVE_PAYPAL_PAYMENT)`:
            statsData.successfulPaypal = numericCount;
            break;
          case `Total failure mobile paypal (ERR_PAYPAL_PAYMENT_PAGE_LOAD_MP/ERR_PAYPAL_PAYMENT_VALIDATION_MP/ERR_PAYPAL_PAYMENT_EAPI_MP)`:
            statsData.failedMobilePaypal = numericCount;
            break;
          case `Total failure desktop paypal (ERR_PAYPAL_PAYMENT_PAGE_LOAD/ERR_PAYPAL_PAYMENT_VALIDATION/ERR_PAYPAL_PAYMENT_EAPI)`:
            statsData.failedDesktopPaypal = numericCount;
            break;
          case "Total open check":
            statsData.openCheck = numericCount;
            break;
        }
      }
    }
    
    // Read existing daily-summary.json or create new array
    const dailySummaryPath = path.resolve(process.cwd(), 'src', 'data', 'daily-summary.json');
    let dailySummary: any[] = [];
    
    if (fs.existsSync(dailySummaryPath)) {
      const existingData = fs.readFileSync(dailySummaryPath, 'utf-8');
      try {
        dailySummary = JSON.parse(existingData);
        if (!Array.isArray(dailySummary)) {
          dailySummary = [];
        }
      } catch (error) {
        console.warn('Failed to parse existing daily-summary.json, starting fresh');
        dailySummary = [];
      }
    }
    
    // Find or create entry for this date
    const existingIndex = dailySummary.findIndex(item => item.date === dateFromTime);
    
    if (existingIndex >= 0) {
      // Update existing entry (merge with existing data)
      dailySummary[existingIndex] = { ...dailySummary[existingIndex], ...statsData };
      console.log(`\nUpdated daily-summary.json for date ${dateFromTime}`);
    } else {
      // Add new entry (keep sorted by date)
      dailySummary.push(statsData);
      dailySummary.sort((a, b) => a.date.localeCompare(b.date));
      console.log(`\nAdded new entry to daily-summary.json for date ${dateFromTime}`);
    }
    
    // Write updated data back to file
    fs.writeFileSync(dailySummaryPath, JSON.stringify(dailySummary, null, 2));
    console.log(`Stats written to: ${dailySummaryPath}`);
  } catch (error) {
    console.error('Failed to write daily-summary.json:', error);
    // Don't fail the test if daily-summary.json write fails
  }

  return singleQueryResults
}