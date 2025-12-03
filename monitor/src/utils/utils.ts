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
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const datetimeFolder = `${year}-${month}-${day}-${hour}-${minute}`;
  return datetimeFolder;
}