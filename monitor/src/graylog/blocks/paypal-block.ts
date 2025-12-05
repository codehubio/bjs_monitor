import {  Page } from '@playwright/test';
import { GraylogHelper } from '../helper';
import { config } from '../../config';
import queries from '../searchText/paypal';
import * as path from 'path';
import { GraylogApiService } from '../api.service';
import {  buildS3BaseUrl, parseUTCTime } from '../../utils/utils';

export async function buildPaypalBlock(page: Page, fromTime: string, toTime: string, prefix: string) {
  const graylogHelper = new GraylogHelper(page);
    const graylogApi = new GraylogApiService();

    // Check if time range is configured
    if (!config.graylogQueryFromTime || !config.graylogQueryToTime) {
      throw new Error('GRAYLOG_QUERY_FROM_TIME and GRAYLOG_QUERY_TO_TIME environment variables must be set');
    }


    // Convert time strings (UTC format: 'YYYY-MM-DD HH:mm:ss') to ISO format for API calls
    // Parse as UTC explicitly to avoid timezone conversion issues
    const fromTimeISO = parseUTCTime(fromTime, -8);
    const toTimeISO = parseUTCTime(toTime, -8);
    // Check if search view ID is configured
    if (!config.graylogDailyEapiSearchView) {
      throw new Error('GRAYLOG_DAILY_EAPI_SEARCH_VIEW environment variable is not set');
    }

    // Create results directory with datetime folder
    const pathElements = prefix.split('/');
    const resultDir = path.resolve(process.cwd(), 'src','graylog','result', pathElements[0], pathElements[1]);
    const results: any [][]= [];

    const paypalQuery = queries[0] as any;
    await graylogHelper.loginAndVisitSearchView(paypalQuery.view);
    await graylogHelper.selectTimeRange(fromTime, toTime);

    results.push([{'PAYPAL Report':{ type: 'separator' }}]);  
    let groupedDataPaypal: any[] = [];
    let totalCountPaypal: number = 0;
    try {
      const apiResult = await graylogApi.executeCountAndGroupBy1ColumnQueryByStreamIdsAndWait(
        paypalQuery.query,
        fromTimeISO,
        toTimeISO,
        paypalQuery.groupBy[0],
        [config.graylogUserFlowStream]
      );
      // Transform groupedData to structured format with type and value
      groupedDataPaypal = apiResult.groupedData.map((item: any) => {
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
      totalCountPaypal = apiResult.groupedData.reduce((sum: number, item: any) => sum + (item.count || 0), 0);
      console.log(`API Query Total Count: ${totalCountPaypal}`);
    } catch (error) {
      console.log(error);
    }
      // Enter the search query and submit
      // The function will automatically submit (press Enter) and wait for the API response
    await graylogHelper.enterQueryText(paypalQuery.query);

    // Take a screenshot for this query result (one screenshot for all grouped data)
    const screenshotFilenamePaypal = `query-paypal-1-result.png`;
    const screenshotPathPaypal = path.join(resultDir, screenshotFilenamePaypal);
    await page.screenshot({ path: screenshotPathPaypal, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPathPaypal}`);
    // Add to arrays for new format
    results.push([{
      name: { type: 'text', value: paypalQuery.name },
      total: { type: 'text', value: totalCountPaypal }
    }]);
    results.push([{screenshot: { type: 'image', value: buildS3BaseUrl(config.s3Prefix, prefix, screenshotFilenamePaypal) }}]);
    results.push(groupedDataPaypal);
    return results;

}

    