import { Page } from '@playwright/test';
import { GraylogHelper } from '../helper';
import { config } from '../../config';
import queries from '../searchText/failed-order';
import * as fs from 'fs';
import * as path from 'path';
import { GraylogApiService } from '../api.service';
import {  buildS3BaseUrl, parseUTCTime, calculateMinOrderNotification, calculateMaxOrderNotification } from '../../utils/utils';

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
  const fromTimeISO = parseUTCTime(fromTime, -8);
  const toTimeISO = parseUTCTime(toTime, -8);
  // Check if search view ID is configured
  if (!config.graylogDailyEapiSearchView) {
    throw new Error('GRAYLOG_DAILY_EAPI_SEARCH_VIEW environment variable is not set');
  }


  // Array to store results (before S3 upload, screenshots are just filenames)
  const results: any [][]= [];
 
  
  const failedOrderQuery = queries[0] as any;
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
    totalCountFailedOrder = apiResult.groupedData.reduce((sum: number, item: any) => sum + (item.count || 0), 0);
    console.log(`API Query Total Count: ${totalCountFailedOrder}`);
  } catch (error) {
    console.log(error);
  }
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
    total: { type: 'text', value: totalCountFailedOrder }
  }]);
  results.push([{screenshot: { type: 'image', value: buildS3BaseUrl(config.s3Prefix, prefix, screenshotFilenameFailedOrder) }}]);
  results.push(groupedDataFailedOrder);
  return results
}

    