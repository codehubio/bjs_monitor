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
import {
  GraylogApiService
} from '../api.service';
import {
  buildS3BaseUrl,
  parseUTCTime
} from '../../utils/utils';

export async function buildSummayBlock(page: Page, fromTime: string, toTime: string, prefix: string) {
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
    await graylogHelper.loginAndVisitSearchView(view);
    await graylogHelper.selectTimeRange(fromTime, toTime);
    console.log(`\n=== Processing Query ${i + 1}/${queries.length} ===`);
    console.log('Query Name:', name);
    console.log('Query:', query);

    // Execute query using Graylog API client and wait for results
    let apiCount: number | null = null;
    try {
      console.log(`\nExecuting query via API...`);
      const apiResult = await graylogApi.executeCountQueryByStreamIdsAndWait(query, fromTimeISO, toTimeISO, [stream]);
      apiCount = apiResult.count;
      console.log(`API Query Count: ${apiCount ?? 'N/A'}`);
    } catch (error) {
      console.error(`Error executing query via API:`, error);
      // Continue with UI-based execution even if API fails
    }

    // Enter the search query and submit
    // The function will automatically submit (press Enter) and wait for the API response
    await graylogHelper.enterQueryText(query);

    // Take a screenshot for this query result
    const screenshotFilename = `query-eapi-${i + 1}-result.png`;
    const screenshotPath = path.join(resultDir, screenshotFilename);
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    console.log(`Screenshot saved: ${screenshotPath}`);

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
        value: buildS3BaseUrl(config.s3Prefix, prefix, screenshotFilename)
      }
    }]);
  }

  return singleQueryResults
}