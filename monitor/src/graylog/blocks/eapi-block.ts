import { Page } from '@playwright/test';
import { GraylogHelper } from '../helper';
import { config } from '../../config';
import queries from '../searchText/eapi';
import * as path from 'path';
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

    // Step 1: Login if needed and visit the search view page
    await graylogHelper.loginAndVisitSearchView(config.graylogDailyEapiSearchView);

    // Step 4: Click on the timerange type target div
    await graylogHelper.selectTimeRange(fromTime, toTime);

    // Array to store results (before S3 upload, screenshots are just filenames)
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
      const screenshotPath = path.join(resultDir, screenshotFilename);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Screenshot saved: ${screenshotPath}`);

      // Store result with field types (screenshot will be updated with S3 URL after upload)
      singleQueryResults.push({
        name: { type: 'text', value: query.name },
        total: { type: 'text', value: apiCount },
        screenshot: { type: 'image', value: buildS3BaseUrl(config.s3Prefix, prefix, screenshotFilename) }
      });
    }
    return singleQueryResults
}

    