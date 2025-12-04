import { GraylogHelper } from '../helper';
import { config } from '../../config';
import queries from '../searchText/payment';
import * as path from 'path';
import * as fs from 'fs';
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
  // Track payment counts by type: mobile and desktop
  let mobileSuccessPayment: number = 0;
  let desktopSuccessPayment: number = 0;
  let mobileFailedPayment: number = 0;
  let desktopFailedPayment: number = 0;

  // Step 4: Loop through each query and execute the same task
  // queries[0] = "Sucess Mobile Payment" (mobile success)
  // queries[1] = "Success Payment" (desktop success - NOT mobile)
  const singleCountPaymentQueries = [queries[0], queries[1]] as any;
  for (let i = 0; i< singleCountPaymentQueries.length; ++i) {
    const query =singleCountPaymentQueries[i]
    const isMobile = query.name.toLowerCase().includes('mobile');
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
      if (isMobile) {
        mobileSuccessPayment += apiCount || 0;
      } else {
        desktopSuccessPayment += apiCount || 0;
      }
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
  // queries[2] = "Failure Mobile Payment" (mobile failed)
  // queries[3] = "Failure Payment" (desktop failed - NOT mobile)
  const groupPaymentQueries = [queries[2], queries[3]] as any;
  for (let i = 0; i< groupPaymentQueries.length; ++i) {
    const query =groupPaymentQueries[i]
    const isMobile = query.name.toLowerCase().includes('mobile');
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
      totalCount = groupedData.reduce((sum, item) => sum + ((item.count?.value ?? item.count) || 0), 0);
      if (isMobile) {
        mobileFailedPayment += totalCount;
      } else {
        desktopFailedPayment += totalCount;
      }
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

  // Write payment stats to daily-stats.json
  try {
    // Extract date from fromTime (format: 'YYYY-MM-DD HH:mm:ss' -> 'YYYY-MM-DD')
    const dateFromTime = fromTime.split(' ')[0]; // Extract date part
    
    // Read existing daily-stats.json
    const dailyStatsPath = path.resolve(process.cwd(), 'src', 'data', 'daily-stats.json');
    type DailyStatsEntry = { 
      date: string; 
      order?: { success: number; failed: number }; 
      openCheck?: { count: number };
      payment?: { 
        mobile?: { success: number; failed: number };
        desktop?: { success: number; failed: number };
        // Support old format for migration
        success?: number;
        failed?: number;
      };
      [key: string]: any 
    };
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
    
    // Find or create entry for this date
    const existingIndex = dailyStats.findIndex(item => item.date === dateFromTime);
    
    if (existingIndex >= 0) {
      // Update existing entry
      // Handle migration from old payment format (success/failed) to new format (mobile/desktop)
      if (dailyStats[existingIndex].payment && ('success' in dailyStats[existingIndex].payment! || 'failed' in dailyStats[existingIndex].payment!)) {
        // Old format exists, preserve it but add new structure
        dailyStats[existingIndex].payment = {
          mobile: {
            success: mobileSuccessPayment,
            failed: mobileFailedPayment
          },
          desktop: {
            success: desktopSuccessPayment,
            failed: desktopFailedPayment
          }
        };
      } else {
        // New format or no payment data
        dailyStats[existingIndex].payment = {
          mobile: {
            success: mobileSuccessPayment,
            failed: mobileFailedPayment
          },
          desktop: {
            success: desktopSuccessPayment,
            failed: desktopFailedPayment
          }
        };
      }
      console.log(`\nUpdated daily-stats.json for date ${dateFromTime}: payment mobile success=${mobileSuccessPayment}, failed=${mobileFailedPayment}, desktop success=${desktopSuccessPayment}, failed=${desktopFailedPayment}`);
    } else {
      // Add new entry (keep sorted by date)
      dailyStats.push({
        date: dateFromTime,
        payment: {
          mobile: {
            success: mobileSuccessPayment,
            failed: mobileFailedPayment
          },
          desktop: {
            success: desktopSuccessPayment,
            failed: desktopFailedPayment
          }
        }
      });
      // Sort by date
      dailyStats.sort((a, b) => a.date.localeCompare(b.date));
      console.log(`\nAdded new entry to daily-stats.json for date ${dateFromTime}: payment mobile success=${mobileSuccessPayment}, failed=${mobileFailedPayment}, desktop success=${desktopSuccessPayment}, failed=${desktopFailedPayment}`);
    }
    
    // Write updated data back to file
    fs.writeFileSync(dailyStatsPath, JSON.stringify(dailyStats, null, 2));
    console.log(`Payment stats written to: ${dailyStatsPath}`);
  } catch (error) {
    console.error('Failed to update daily-stats.json:', error);
    // Don't fail the test if daily-stats.json update fails
  }

  return results;
}
  