import { test, expect } from '@playwright/test';
import { GraylogHelper } from '../helper';
import { config } from '../../config';
import queries, { GROUP_BY_COLUMN_1, GROUP_BY_COLUMN_2, GROUP_BY_COLUMN_3 } from '../searchText/payment';
import * as fs from 'fs';
import * as path from 'path';
import { uploadFolderToS3 } from '../../utils/uploadToS3';
import { buildAndSendGroup2ColumnAdaptiveCard } from '../../utils/sendToMsTeams';
import { GraylogApiService } from '../api.service';
import { buildFailedPaymentBlock } from '../blocks/payment.block';
import { buildDateTimeFolder } from '../../utils/utils';

test.describe('Failed Payment Search', () => {
  test('should login, report failed payments, wait for results', async ({ page }) => {

  const fromTime = config.graylogQueryFromTime;
  const toTime = config.graylogQueryToTime;
    const failedPaymentBlock = await buildFailedPaymentBlock(page, fromTime, toTime);
    const datetimeFolder=buildDateTimeFolder();
    // Create results directory with datetime folder
  const resultsDir = path.resolve(process.cwd(), 'src','graylog','result', 'failed-payment', datetimeFolder);
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  let s3BaseUrl = '';
  let s3Path = '';
    const jsonPath = path.join(resultsDir, 'results.json');
    fs.writeFileSync(jsonPath, JSON.stringify(failedPaymentBlock, null, 2));
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

        const title = `Failed Payment Report - ${fromTime} to ${toTime}`;
        
        // Pass additional column to display in sub-table (column 3 has 1-1-1 mapping with column 2)
        await buildAndSendGroup2ColumnAdaptiveCard(
          title, 
          failedPaymentBlock, 
          GROUP_BY_COLUMN_1, 
          GROUP_BY_COLUMN_2, 
          urls,
          [GROUP_BY_COLUMN_3]
        );
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

