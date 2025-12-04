/**
 * Configuration file for environment variables
 */
export const config = {
  graylogWebUrl: process.env.GRAYLOG_WEB_URL || 'https://gray.prod.bjsrestaurants.com',
  graylogApiUrl: process.env.GRAYLOG_API_URL || 'https://gray.prod.bjsrestaurants.com/api',
  graylogUsername: process.env.GRAYLOG_USERNAME || '',
  graylogPassword: process.env.GRAYLOG_PASSWORD || '',
  graylogEapiStream: process.env.GRAYLOG_EAPI_STREAM || '',
  graylogUserFlowStream: process.env.GRAYLOG_USER_FLOW_STREAM || '',
  graylogSearchViewId: process.env.GRAYLOG_SEARCH_VIEW_ID || '',
  graylogPaymentSearchView: process.env.GRAYLOG_PAYMENT_SEARCH_VIEW || '',
  graylogDailyEapiSearchView: process.env.GRAYLOG_DAILY_EAPI_SEARCH_VIEW || '',
  graylogSubmitOrderSearchView: process.env.GRAYLOG_SUBMIT_ORDER_SEARCH_VIEW || '',
  graylogOpenCheckSearchView: process.env.GRAYLOG_OPEN_CHECK_SEARCH_VIEW || '',
  graylogPaypalSearchView: process.env.GRAYLOG_PAYPAL_SEARCH_VIEW || '',
  graylogFailedOrderSearchView: process.env.GRAYLOG_FAILED_ORDER_SEARCH_VIEW || '',
  graylogQueryFromTime: process.env.GRAYLOG_QUERY_FROM_TIME || '',
  graylogQueryToTime: process.env.GRAYLOG_QUERY_TO_TIME || '',
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  s3Bucket: process.env.AWS_S3_BUCKET || '',
  s3Prefix: process.env.AWS_S3_PREFIX || '',
  s3Endpoint: process.env.AWS_S3_ENDPOINT || '',
  s3ForcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
  baseS3Url: process.env.BASE_S3_URL || '',
  msTeamWebhookUrl: process.env.MS_TEAM_WEBHOOK_URL || '',
  eapiBaseUrl: process.env.EAPI_BASE_URL || '',
  eapiSecurityToken: process.env.EAPI_SECURITY_TOKEN || '',
};

