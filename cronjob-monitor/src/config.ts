/**
 * Configuration file for environment variables
 */
export const config = {
  bjsBaseUrl: process.env.BJs_BASE_URL || '',
  bjsGetMenuItemListUrl: process.env.BJs_GetMenuItemList_URL || '',
  bjsSecurityToken: process.env.BJs_SECURITY_TOKEN || '',
  bjsCustomerId: process.env.BJs_CUSTOMER_ID || '',
  bjsLoyaltyId: process.env.BJs_LOYALTY_ID || '',
  bjsDeviceId: process.env.BJs_DEVICE_ID || '',
  bjsWebUrl: process.env.BJs_Web_Url || '',
  bjsMenuPath: process.env.BJs_Menu_Path || '',
  bjsFindLocationPath: process.env.BJs_Find_Location_Path || '',
  bjsLocationPath: process.env.BJs_Location_Path || '',
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  s3Bucket: process.env.AWS_S3_BUCKET || '',
  s3Prefix: process.env.AWS_S3_PREFIX || '',
  s3Endpoint: process.env.AWS_S3_ENDPOINT || '',
  s3ForcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
  baseS3Url: process.env.BASE_S3_URL || '',
  msTeamWebhookUrl: process.env.MS_TEAM_WEBHOOK_URL || '',
};

