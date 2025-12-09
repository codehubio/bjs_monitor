import { config } from '../config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Build S3 base URL from s3Prefix and a custom prefix
 * @param s3Prefix The S3 prefix from config (e.g., 'monitor_report')
 * @param customPrefix The custom prefix to append (e.g., 'daily-eapi', 'submit-order')
 * @param datetimeFolder Optional datetime folder to append (e.g., '25-12-03-15-26')
 * @param filename Optional filename to append (e.g., 'query-1-result.png')
 * @returns The complete S3 base URL
 */
export function buildS3BaseUrl(
  s3Prefix: string,
  prefix: string,
  filename?: string
): string {
  // Build the full prefix: s3Prefix/customPrefix or just customPrefix if s3Prefix is empty
  let fullPath = `${s3Prefix}/${prefix}`;
  
  if (filename) {
    fullPath = `${fullPath}/${filename}`;
  }
  
  // Build public S3 URL for screenshots using BASE_S3_URL from .env
  if (config.baseS3Url) {
    // Use BASE_S3_URL if provided, ensuring it ends with a slash
    const baseUrl = config.baseS3Url.endsWith('/') ? config.baseS3Url : `${config.baseS3Url}/`;
    return `${baseUrl}${fullPath}`;
  }
  
  // Fallback to manual construction if BASE_S3_URL is not set
  if (config.s3Endpoint) {
    // Custom endpoint (e.g., MinIO, DigitalOcean Spaces)
    if (config.s3ForcePathStyle) {
      return `${config.s3Endpoint}/${config.s3Bucket}/${fullPath}`;
    } else {
      return `${config.s3Endpoint}/${fullPath}`;
    }
  }
  
  // Standard AWS S3
  if (config.s3ForcePathStyle) {
    return `https://s3.${config.awsRegion}.amazonaws.com/${config.s3Bucket}/${fullPath}`;
  } else {
    return `https://${config.s3Bucket}.s3.${config.awsRegion}.amazonaws.com/${fullPath}`;
  }
}

export function buildDateTimeFolder() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  // const hour = String(now.getHours()).padStart(2, '0');
  // const minute = String(now.getMinutes()).padStart(2, '0');
  const datetimeFolder = `${year}-${month}-${day}`;
  return datetimeFolder;
}

/**
 * Parse a time string and convert it to UTC ISO format
 * @param timeStr Time string in format 'YYYY-MM-DD HH:mm:ss'
 * @param timezoneOffset Optional timezone offset in hours (e.g., -8 for UTC-8, +9 for UTC+9). Defaults to 0 (UTC)
 * @returns ISO format string (e.g., '2025-11-29T08:00:00.000Z')
 */
export function parseUTCTime(timeStr: string, timezoneOffset: number = 0): string {
  // Format: '2025-11-29 08:00:00' -> '2025-11-29T08:00:00'
  const dateTimeStr = timeStr.replace(' ', 'T');
  
  // If timezone offset is 0 (UTC), simply append '.000Z'
  if (timezoneOffset === 0) {
    return `${dateTimeStr}.000Z`;
  }
  
  // Parse the date components
  const [datePart, timePart] = timeStr.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);
  
  // Create a date object from the input time (treating it as if it were in the specified timezone)
  // To convert to UTC, we subtract the timezone offset (in hours)
  // Example: If time is 08:00 in UTC-8, then UTC = 08:00 - (-8) = 16:00
  // Formula: UTC = localTime - timezoneOffset
  const offsetMs = timezoneOffset * 60 * 60 * 1000; // Convert hours to milliseconds
  const localDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second || 0));
  const utcDate = new Date(localDate.getTime() - offsetMs);
  
  return utcDate.toISOString();
}

/**
 * Type definition for daily stats entry
 */
export type DailyStatsEntry = { 
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
  eapi?: {
    total?: number;
    errors4xx?: number;
    errors5xx?: number;
    errorsOther?: number;
    httpErrors?: Array<{ status: string; count: number }>;
    [key: string]: any;
  };
  [key: string]: any 
};

/**
 * Deep merge two objects, with the source object taking precedence
 * @param target The target object to merge into
 * @param source The source object to merge from
 * @returns The merged object
 */
function deepMerge(target: any, source: any): any {
  if (!source || typeof source !== 'object') {
    return source;
  }
  
  if (!target || typeof target !== 'object') {
    return source;
  }
  
  const result = { ...target };
  
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        // Recursively merge nested objects
        result[key] = deepMerge(result[key], source[key]);
      } else {
        // Overwrite with source value (including arrays and primitives)
        result[key] = source[key];
      }
    }
  }
  
  return result;
}

/**
 * Merge data entry to daily-stats.json
 * Reads existing daily-stats.json, merges the dateEntry, and writes back to file
 * @param dateEntry The entry to merge (must have a 'date' field)
 * @returns The updated daily stats array
 */
export function mergeToDailyStats(dateEntry: DailyStatsEntry): DailyStatsEntry[] {
  const dailyStatsPath = path.resolve(process.cwd(), 'src', 'data', 'daily-stats.json');
  
  if (!dateEntry.date) {
    throw new Error('dateEntry must have a "date" field');
  }
  
  let dailyStats: DailyStatsEntry[] = [];
  
  // Read existing daily-stats.json
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
  const existingIndex = dailyStats.findIndex(item => item.date === dateEntry.date);
  
  if (existingIndex >= 0) {
    // Update existing entry with deep merge
    dailyStats[existingIndex] = deepMerge(dailyStats[existingIndex], dateEntry);
    console.log(`\nUpdated daily-stats.json for date ${dateEntry.date}`);
  } else {
    // Add new entry (keep sorted by date)
    dailyStats.push(dateEntry);
    // Sort by date
    dailyStats.sort((a, b) => a.date.localeCompare(b.date));
    console.log(`\nAdded new entry to daily-stats.json for date ${dateEntry.date}`);
  }
  
  // Write updated data back to file
  fs.writeFileSync(dailyStatsPath, JSON.stringify(dailyStats, null, 2));
  console.log(`Stats written to: ${dailyStatsPath}`);
  
  return dailyStats;
}

/**
 * Merge data entry to daily-summary.json
 * Reads existing daily-summary.json, merges the dateEntry, and writes back to file
 * @param dateEntry The entry to merge (must have a 'date' field)
 * @returns The updated daily summary array
 */
export function mergeToDailySummary(dateEntry: any): any[] {
  const dailySummaryPath = path.resolve(process.cwd(), 'src', 'data', 'daily-summary.json');
  
  if (!dateEntry.date) {
    throw new Error('dateEntry must have a "date" field');
  }
  
  let dailySummary: any[] = [];
  
  // Read existing daily-summary.json
  if (fs.existsSync(dailySummaryPath)) {
    const existingData = fs.readFileSync(dailySummaryPath, 'utf-8');
    try {
      const parsed = JSON.parse(existingData);
      if (Array.isArray(parsed)) {
        dailySummary = parsed;
      } else {
        dailySummary = [];
      }
    } catch (error) {
      console.warn('Failed to parse existing daily-summary.json, starting fresh');
      dailySummary = [];
    }
  }
  
  // Find or create entry for this date
  const existingIndex = dailySummary.findIndex(item => item.date === dateEntry.date);
  
  if (existingIndex >= 0) {
    // Update existing entry with deep merge
    dailySummary[existingIndex] = deepMerge(dailySummary[existingIndex], dateEntry);
    console.log(`\nUpdated daily-summary.json for date ${dateEntry.date}`);
  } else {
    // Add new entry (keep sorted by date)
    dailySummary.push(dateEntry);
    // Sort by date
    dailySummary.sort((a, b) => a.date.localeCompare(b.date));
    console.log(`\nAdded new entry to daily-summary.json for date ${dateEntry.date}`);
  }
  
  // Write updated data back to file
  fs.writeFileSync(dailySummaryPath, JSON.stringify(dailySummary, null, 2));
  console.log(`Stats written to: ${dailySummaryPath}`);
  
  return dailySummary;
}

/**
 * Calculate if minimum order notification should be sent
 * Reads order data from daily-summary.json
 * @param currentDate The current date string (format: 'YYYY-MM-DD')
 * @param totalOrders Total number of orders
 * @param successOrders Number of successful orders
 * @returns Object with notify flag and reason string
 */
export function calculateMinOrderNotification(
  currentDate: string,
  totalOrders: number,
  successOrders: number
): { notify: boolean; reason: string } {
  const reasons: string[] = [];
  let shouldNotify = false;

  // Read order data from daily-summary.json
  // Note: daily-summary.json uses 'successfulOrders' for successful orders and 'failedOrders' for failed orders
  const dailySummaryPath = path.resolve(process.cwd(), 'src', 'data', 'daily-summary.json');
  let orderData: Array<{ date: string; success: number; failed: number }> = [];
  
  if (fs.existsSync(dailySummaryPath)) {
    try {
      const existingData = fs.readFileSync(dailySummaryPath, 'utf-8');
      const parsed = JSON.parse(existingData);
      if (Array.isArray(parsed)) {
        // Extract order data from daily-summary.json
        // Map successfulOrders -> success, failedOrders -> failed for internal use
        orderData = parsed
          .filter((item: any) => item.successfulOrders !== undefined && item.failedOrders !== undefined)
          .map((item: any) => ({
            date: item.date,
            success: item.successfulOrders || 0,  // successfulOrders from daily-summary.json
            failed: item.failedOrders || 0         // failedOrders from daily-summary.json
          }));
      }
    } catch (error) {
      console.warn('Failed to read daily-summary.json for order notification calculation:', error);
    }
  }

  // Condition 1: Check if total or success is in top 10% lowest
  // if (orderData.length > 0) {
  //   // Get all historical totals and successes
  //   const allTotals = orderData.map(item => item.success + item.failed).filter(v => v > 0);
  //   const allSuccesses = orderData.map(item => item.success).filter(v => v > 0);
    
  //   if (allTotals.length > 0 && allSuccesses.length > 0) {
  //     // Sort to find 10th percentile
  //     const sortedTotals = [...allTotals].sort((a, b) => a - b);
  //     const sortedSuccesses = [...allSuccesses].sort((a, b) => a - b);
      
  //     // Calculate 10th percentile index (10% of data)
  //     const percentile10Index = Math.max(0, Math.floor(sortedTotals.length * 0.1));
  //     const percentile10Total = sortedTotals[percentile10Index];
  //     const percentile10Success = sortedSuccesses[percentile10Index];
      
  //     // Check if current values are in top 10% lowest
  //     if (successOrders <= percentile10Success) {
  //       shouldNotify = true;
  //       reasons.push(`Successful orders (${successOrders}) is in top 10% lowest (threshold: ${percentile10Success})`);
  //     }
  //   }
  // }

  // Condition 2: Check if total or success is lower than 4 previous 7-day periods by more than 200
  const currentDateObj = new Date(currentDate);
  const previousPeriods: string[] = [];
  
  // Calculate dates for 4 previous 7-day periods (7, 14, 21, 28 days ago)
  for (let daysAgo = 7; daysAgo <=7*4; daysAgo += 7) {
    const previousDate = new Date(currentDateObj);
    previousDate.setDate(previousDate.getDate() - daysAgo);
    const previousDateStr = previousDate.toISOString().split('T')[0];
    previousPeriods.push(previousDateStr);
  }
  
  // Find data for previous periods
  const previousData = previousPeriods.map(date => {
    return orderData.find(item => item.date === date);
  }).filter(item => item !== undefined) as Array<{ date: string; success: number; failed: number }>;
  
  // Compare with each previous period
  previousData.forEach(prev => {
    const prevSuccess = prev.success;
    const successDiff = prevSuccess - successOrders;
    
    if (successDiff > 200) {
      reasons.push(`less-than-200 higher than ${prev.date} (${prevSuccess})`);
    }
  });

  // Build reason string
  shouldNotify = reasons.length >= 4;
  let reason = '';
  if (shouldNotify) {
    reason = reasons.join('; ');
  } else {
    reason = 'No conditions met: Total and successful orders are within normal range';
  }
  console.log(reasons);
  return {
    notify: shouldNotify,
    reason: reason
  };
}

/**
 * Calculate if maximum order notification should be sent
 * Reads order data from daily-summary.json
 * @param currentDate The current date string (format: 'YYYY-MM-DD')
 * @param totalOrders Total number of orders
 * @param successOrders Number of successful orders
 * @returns Object with notify flag and reason string
 */
export function calculateMaxOrderNotification(
  currentDate: string,
  totalOrders: number,
  successOrders: number
): { notify: boolean; reason: string } {
  const reasons: string[] = [];
  // let shouldNotify = false;

  // Read order data from daily-summary.json
  // Note: daily-summary.json uses 'successfulOrders' for successful orders and 'failedOrders' for failed orders
  const dailySummaryPath = path.resolve(process.cwd(), 'src', 'data', 'daily-summary.json');
  let orderData: Array<{ date: string; success: number; failed: number }> = [];
  
  if (fs.existsSync(dailySummaryPath)) {
    try {
      const existingData = fs.readFileSync(dailySummaryPath, 'utf-8');
      const parsed = JSON.parse(existingData);
      if (Array.isArray(parsed)) {
        // Extract order data from daily-summary.json
        // Map successfulOrders -> success, failedOrders -> failed for internal use
        orderData = parsed
          .filter((item: any) => item.successfulOrders !== undefined && item.failedOrders !== undefined)
          .map((item: any) => ({
            date: item.date,
            success: item.successfulOrders || 0,  // successfulOrders from daily-summary.json
            failed: item.failedOrders || 0         // failedOrders from daily-summary.json
          }));
      }
    } catch (error) {
      console.warn('Failed to read daily-summary.json for order notification calculation:', error);
    }
  }

  // Condition 1: Check if total or success is in top 5% highest
  // if (orderData.length > 0) {
  //   // Get all historical totals and successes
  //   const allTotals = orderData.map(item => item.success + item.failed).filter(v => v > 0);
  //   const allSuccesses = orderData.map(item => item.success).filter(v => v > 0);
    
  //   if (allTotals.length > 0 && allSuccesses.length > 0) {
  //     // Sort to find 95th percentile (top 5%)
  //     const sortedTotals = [...allTotals].sort((a, b) => a - b);
  //     const sortedSuccesses = [...allSuccesses].sort((a, b) => a - b);
      
  //     // Calculate 95th percentile index (95% of data, meaning top 5%)
  //     const percentile95Index = Math.max(0, Math.floor(sortedTotals.length * 0.95));
  //     const percentile95Total = sortedTotals[percentile95Index];
  //     const percentile95Success = sortedSuccesses[percentile95Index];
      
  //     // Check if current values are in top 5% highest
  //     if (totalOrders >= percentile95Total) {
  //       shouldNotify = true;
  //       reasons.push(`Total orders (${totalOrders}) is in top 5% highest (threshold: ${percentile95Total})`);
  //     }
      
  //     if (successOrders >= percentile95Success) {
  //       shouldNotify = true;
  //       reasons.push(`Successful orders (${successOrders}) is in top 5% highest (threshold: ${percentile95Success})`);
  //     }
  //   }
  // }

  // Condition 2: Check if total or success is higher than 7 previous 7-day periods by more than 200
  const currentDateObj = new Date(currentDate);
  const previousPeriods: string[] = [];
  
  // Calculate dates for 7 previous 7-day periods (7, 14, 21, 28, 35, 42, 49 days ago)
  for (let daysAgo = 7; daysAgo <= 7*30; daysAgo += 7) {
    const previousDate = new Date(currentDateObj);
    previousDate.setDate(previousDate.getDate() - daysAgo);
    const previousDateStr = previousDate.toISOString().split('T')[0];
    previousPeriods.push(previousDateStr);
  }
  
  // Find data for previous periods
  const previousData = previousPeriods.map(date => {
    return orderData.find(item => item.date === date);
  }).filter(item => item !== undefined) as Array<{ date: string; success: number; failed: number }>;
  
  // Compare with each previous period
  previousData.forEach(prev => {
    const prevSuccess = prev.success;
    const successDiff = successOrders - prevSuccess;
    
    if (successDiff > 200) {
      // shouldNotify = true;
      reasons.push(`more-than-200 higher than ${prev.date} (${prevSuccess})`);
    }
  });

  // Build reason string
  let reason = '';
  const shouldNotify = reasons.length >= 7;
  if (shouldNotify) {
    reason = reasons.join('; ');
  } else {
    reason = 'No conditions met: Total and successful orders are within normal range';
  }

  return {
    notify: shouldNotify,
    reason: reason
  };
}