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
  customPrefix: string,
  datetimeFolder?: string,
  filename?: string
): string {
  // Build the full prefix: s3Prefix/customPrefix or just customPrefix if s3Prefix is empty
  const fullPrefix = s3Prefix ? `${s3Prefix}/${customPrefix}` : customPrefix;
  
  // Build the path with optional datetime folder and filename
  let path = datetimeFolder ? `${fullPrefix}/${datetimeFolder}` : fullPrefix;
  if (filename) {
    path = `${path}/${filename}`;
  }
  
  // Build public S3 URL for screenshots using BASE_S3_URL from .env
  if (config.baseS3Url) {
    // Use BASE_S3_URL if provided, ensuring it ends with a slash
    const baseUrl = config.baseS3Url.endsWith('/') ? config.baseS3Url : `${config.baseS3Url}/`;
    return `${baseUrl}${path}`;
  }
  
  // Fallback to manual construction if BASE_S3_URL is not set
  if (config.s3Endpoint) {
    // Custom endpoint (e.g., MinIO, DigitalOcean Spaces)
    if (config.s3ForcePathStyle) {
      return `${config.s3Endpoint}/${config.s3Bucket}/${path}`;
    } else {
      return `${config.s3Endpoint}/${path}`;
    }
  }
  
  // Standard AWS S3
  if (config.s3ForcePathStyle) {
    return `https://s3.${config.awsRegion}.amazonaws.com/${config.s3Bucket}/${path}`;
  } else {
    return `https://${config.s3Bucket}.s3.${config.awsRegion}.amazonaws.com/${path}`;
  }
}

