import { test } from '@playwright/test';
import { config } from '../../config';
import * as fs from 'fs';
import * as path from 'path';
import { uploadFolderToS3 } from '../../utils/uploadToS3';
import { buildAndSendAdaptiveCard } from '../../utils/sendToMsTeams';
import { buildDateTimeFolder } from '../../utils/utils';
import { buildPaymentBlock } from '../blocks/payment.block';
import { buildEapiBlock } from '../blocks/eapi-block';
import { buildOrderBlock } from '../blocks/order-block';
import { buildPaypalBlock } from '../blocks/paypal-block';



test.describe('Daily EAPI Search', () => {
  test('should login, report daily eapi, wait for results', async ({ page }) => {
    // Check if time range is configured
    if (!config.graylogQueryFromTime || !config.graylogQueryToTime) {
      throw new Error('GRAYLOG_QUERY_FROM_TIME and GRAYLOG_QUERY_TO_TIME environment variables must be set');
    }

    const fromTime = config.graylogQueryFromTime;
    const toTime = config.graylogQueryToTime;

    // Check if search view ID is configured
    if (!config.graylogDailyEapiSearchView) {
      throw new Error('GRAYLOG_DAILY_EAPI_SEARCH_VIEW environment variable is not set');
    }

    // Generate datetime string in format dd-mm-yy-hh-MM
    const datetimeFolder = buildDateTimeFolder();
    const prefix =`daily-eapi/${datetimeFolder}`

    // Create results directory with datetime folder
    const resultsDir = path.resolve(process.cwd(), 'src','graylog','result', 'daily-eapi', datetimeFolder);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    const results: any [][]= [];
    results.push([{'EAPI Report':{ type: 'separator' }}]);  
    const eapiBlock = await buildEapiBlock(page, fromTime, toTime, prefix);
    results.push(...eapiBlock);
    
    results.push([{'Order Report':{ type: 'separator' }}]);  
    const orderBlock = await buildOrderBlock(page, fromTime, toTime, prefix);
    results.push(...orderBlock);

    results.push([{'Paypal Report':{ type: 'separator' }}]);  
    const paypalBlock = await buildPaypalBlock(page, fromTime, toTime, prefix);
    results.push(...paypalBlock);

    // const failedPaymentBlock = await buildPaymentBlock(page, fromTime, toTime, prefix);
    // results.push(...failedPaymentBlock)



    // Step 5: Upload results folder to S3 with custom prefix
    let s3Path = '';
    try {
      console.log(`\nUploading results folder to S3...`);
      const s3Prefix = config.s3Prefix || '';
      await uploadFolderToS3(resultsDir, `${s3Prefix}/daily-eapi`);
      console.log('Upload to S3 completed successfully');
    } catch (error) {
      console.error('Failed to upload to S3:', error);
      // Don't fail the test if S3 upload fails, just log the error
      // Screenshot values will remain as filenames
    }

    // Write results to JSON file (after S3 upload to include URLs)
    const jsonPath = path.join(resultsDir, 'results.json');
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    console.log(`\nResults written to: ${jsonPath}`);

    // Step 6: Send results to MS Teams
    if (config.msTeamWebhookUrl) {
      try {
        console.log(`\nSending results to MS Teams...`);
        
        // Build URLs array (S3 path if available)
        const urls: string[] = [];
        if (s3Path) {
          urls.push(s3Path);
        }

        const title = `Report status - ${fromTime} to ${toTime}`;
        
        // Pass results as array of arrays - wrap single array in another array
        // Headers will be automatically extracted from field names
        await buildAndSendAdaptiveCard(title, results, urls);
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

