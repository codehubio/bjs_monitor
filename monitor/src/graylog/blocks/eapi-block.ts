import { Page } from '@playwright/test';
import { GraylogHelper } from '../helper';
import { config } from '../../config';
import queries from '../searchText/eapi';
import * as path from 'path';
import * as fs from 'fs';
import { GraylogApiService } from '../api.service';
import { buildS3BaseUrl } from '../../utils/utils';

export async function buildEapiBlock(page: Page, fromTime: string, toTime: string, prefix: string) {
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

    // Array to store results (before S3 upload, screenshots are just filenames)
    const singleQueryResults: any []= [];
    let totalApiCalls: number = 0;

    // Step 4: Loop through each query and execute the same task
    for (let i = 0; i < 5; i++) {
      const query = queries[i] as any;
      console.log(`\n=== Processing Query ${i + 1}/${queries.length} ===`);
      console.log('Query Name:', query.name);
      console.log('Query:', query.query);

      // Navigate to query-specific view if provided and different from current view
      const queryView = query.view || config.graylogDailyEapiSearchView;
      console.log(`Navigating to query-specific view: ${queryView}`);
      await graylogHelper.loginAndVisitSearchView(queryView);
      await graylogHelper.selectTimeRange(fromTime, toTime);

      // Execute query using Graylog API client and wait for results
      let apiCount: number | null = null;
      try {
        console.log(`\nExecuting query via API...`);
        const streamIds = config.graylogEapiStream ? [config.graylogEapiStream] : undefined;
        const apiResult = await graylogApi.executeCountQueryByStreamIdsAndWait(query.query, fromTimeISO, toTimeISO, streamIds);
        apiCount = apiResult.count;
        // Track total API calls from "All EAPI calls" query (queries[0])
        if (i === 0 && query.name === "All EAPI calls") {
          totalApiCalls = apiCount || 0;
        }
        console.log(`API Query Count: ${apiCount ?? 'N/A'}`);
      } catch (error) {
        console.error(`Error executing query via API:`, error);
        // Continue with UI-based execution even if API fails
      }

      // Enter the search query and submit
      // The function will automatically submit (press Enter) and wait for the API response
      await graylogHelper.enterQueryText(query.query);

      // Take a screenshot for this query result
      const screenshotFilename = `query-eapi-${i + 1}-result.png`;
      const screenshotPath = path.join(resultDir, screenshotFilename);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Screenshot saved: ${screenshotPath}`);

      // Store result with field types (screenshot will be updated with S3 URL after upload)
      singleQueryResults.push([{
        name: { type: 'text', value: query.name },
        total: { type: 'text', value: apiCount },
        screenshot: { type: 'image', value: buildS3BaseUrl(config.s3Prefix, prefix, screenshotFilename) }
      }]);
    }
    const failedEapiQuery = queries[5] as any;
    await graylogHelper.loginAndVisitSearchView(failedEapiQuery.view);
    await graylogHelper.selectTimeRange(fromTime, toTime);
    await graylogHelper.enterQueryText(failedEapiQuery.query);
    const screenshotFilename = `query-eapi-100-failed-result.png`;
    const screenshotPath = path.join(resultDir, screenshotFilename);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPath}`);
    let groupedData: any[] = [];
    let totalCount: number = 0;
    let httpErrors: Array<{ status: number | string; count: number }> = [];
    let count4xx: number = 0;
    let count5xx: number = 0;
    let countOther: number = 0;
    
    try {
      const apiResult = await graylogApi.executeCountAndGroupBy1ColumnQueryByStreamIdsAndWait(
        failedEapiQuery.query,
        fromTimeISO,
        toTimeISO,
        failedEapiQuery.groupBy[0],
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
      
      // Process HTTP status codes to calculate 4xx, 5xx, and other counts
      apiResult.groupedData.forEach((item: any) => {
        const httpStatus = item.eapi_http_status;
        const count = item.count || 0;
        
        // Preserve HTTP error details
        httpErrors.push({
          status: httpStatus,
          count: count
        });
        
        // Calculate 4xx, 5xx, and other counts
        if (httpStatus !== null && httpStatus !== undefined) {
          const statusNum = typeof httpStatus === 'string' ? parseInt(httpStatus, 10) : httpStatus;
          if (!isNaN(statusNum)) {
            if (statusNum >= 400 && statusNum < 500) {
              count4xx += count;
            } else if (statusNum >= 500 && statusNum < 600) {
              count5xx += count;
            } else {
              // Other status codes (not 4xx or 5xx)
              countOther += count;
            }
          } else {
            // If status is not a valid number, count it as "other"
            countOther += count;
          }
        } else {
          // If status is null/undefined, count it as "other"
          countOther += count;
        }
      });
      
      totalCount = apiResult.groupedData.reduce((sum: number, item: any) => sum + (item.count || 0), 0);
      console.log(`API Query Total Count: ${totalCount}`);
      console.log(`4xx Errors: ${count4xx}, 5xx Errors: ${count5xx}, Other: ${countOther}`);
    } catch (error) {
      console.log(error);
    }
    singleQueryResults.push(groupedData);

    // Write EAPI stats to daily-stats.json
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
        };
        eapi?: {
          total: number;
          errors4xx: number;
          errors5xx: number;
          errorsOther: number;
          httpErrors?: Array<{ status: number | string; count: number }>;
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
        dailyStats[existingIndex].eapi = {
          total: totalApiCalls,
          errors4xx: count4xx,
          errors5xx: count5xx,
          errorsOther: countOther,
          httpErrors: httpErrors
        };
        console.log(`\nUpdated daily-stats.json for date ${dateFromTime}: eapi total=${totalApiCalls}, 4xx=${count4xx}, 5xx=${count5xx}, other=${countOther}`);
      } else {
        // Add new entry (keep sorted by date)
        dailyStats.push({
          date: dateFromTime,
          eapi: {
            total: totalApiCalls,
            errors4xx: count4xx,
            errors5xx: count5xx,
            errorsOther: countOther,
            httpErrors: httpErrors
          }
        });
        // Sort by date
        dailyStats.sort((a, b) => a.date.localeCompare(b.date));
        console.log(`\nAdded new entry to daily-stats.json for date ${dateFromTime}: eapi total=${totalApiCalls}, 4xx=${count4xx}, 5xx=${count5xx}, other=${countOther}`);
      }
      
      // Write updated data back to file
      fs.writeFileSync(dailyStatsPath, JSON.stringify(dailyStats, null, 2));
      console.log(`EAPI stats written to: ${dailyStatsPath}`);
    } catch (error) {
      console.error('Failed to update daily-stats.json:', error);
      // Don't fail the test if daily-stats.json update fails
    }

    return singleQueryResults
}

    