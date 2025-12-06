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
};

