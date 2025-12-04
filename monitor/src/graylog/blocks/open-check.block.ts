import { Page } from '@playwright/test';
import { GraylogHelper } from '../helper';
import { config } from '../../config';
import queries from '../searchText/open-check';
import * as path from 'path';
import * as fs from 'fs';
import { GraylogApiService } from '../api.service';
import { buildS3BaseUrl } from '../../utils/utils';

export async function buildOpenCheckBlock(page: Page, fromTime: string, toTime: string, prefix: string) {
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

    const singleQueryResults: any []= [];
    let totalOpenCheckCount: number = 0;

    // Step 4: Loop through each query and execute the same task
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i] as any;
      console.log(query)
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
        const apiResult = await graylogApi.executeCountQueryByStreamIdsAndWait(query.query, fromTimeISO, toTimeISO, [config.graylogUserFlowStream]);
        apiCount = apiResult.count;
        totalOpenCheckCount += apiCount || 0;
        console.log(`API Query Count: ${apiCount ?? 'N/A'}`);
      } catch (error) {
        console.error(`Error executing query via API:`, error);
        // Continue with UI-based execution even if API fails
      }

      // Enter the search query and submit
      // The function will automatically submit (press Enter) and wait for the API response
      await graylogHelper.enterQueryText(query.query);

      // Take a screenshot for this query result
      const screenshotFilename = `query-open-check-${i + 1}-result.png`;
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

    // Write open check stats to daily-stats.json
    try {
      // Extract date from fromTime (format: 'YYYY-MM-DD HH:mm:ss' -> 'YYYY-MM-DD')
      const dateFromTime = fromTime.split(' ')[0]; // Extract date part
      
      // Read existing daily-stats.json
      const dailyStatsPath = path.resolve(process.cwd(), 'src', 'data', 'daily-stats.json');
      type DailyStatsEntry = { date: string; order?: { success: number; failed: number }; openCheck?: { count: number }; [key: string]: any };
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
        dailyStats[existingIndex].openCheck = { count: totalOpenCheckCount };
        console.log(`\nUpdated daily-stats.json for date ${dateFromTime}: openCheck count=${totalOpenCheckCount}`);
      } else {
        // Add new entry (keep sorted by date)
        dailyStats.push({
          date: dateFromTime,
          openCheck: { count: totalOpenCheckCount }
        });
        // Sort by date
        dailyStats.sort((a, b) => a.date.localeCompare(b.date));
        console.log(`\nAdded new entry to daily-stats.json for date ${dateFromTime}: openCheck count=${totalOpenCheckCount}`);
      }
      
      // Write updated data back to file
      fs.writeFileSync(dailyStatsPath, JSON.stringify(dailyStats, null, 2));
      console.log(`Open check stats written to: ${dailyStatsPath}`);
    } catch (error) {
      console.error('Failed to update daily-stats.json:', error);
      // Don't fail the test if daily-stats.json update fails
    }

    return singleQueryResults
}

    