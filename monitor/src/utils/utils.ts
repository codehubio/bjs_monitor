import { config } from '../config';

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