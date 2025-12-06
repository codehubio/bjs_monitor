import axios, { AxiosResponse } from 'axios';
import { config } from '../config';

/**
 * Response structure for GetMenuItemList API
 */
export interface MenuItemListResponse {
  GetMenuItemListResult: {
    Data: any[];
    [key: string]: any;
  };
}

/**
 * Get menu item list for a specific site and category
 * @param parsedCategoryId The parsed category ID (e.g., "137")
 * @param parsedSiteId The parsed site ID (e.g., "443")
 * @returns Promise with the menu item list response
 */
export async function getMenuItemList(
  parsedCategoryId: string,
  parsedSiteId: string
): Promise<MenuItemListResponse> {
  // Validate configuration
  if (!config.bjsBaseUrl) {
    throw new Error('BJs_BASE_URL environment variable is not set');
  }
  if (!config.bjsGetMenuItemListUrl) {
    throw new Error('BJs_GetMenuItemList_URL environment variable is not set');
  }
  if (!config.bjsSecurityToken) {
    throw new Error('BJs_SECURITY_TOKEN environment variable is not set');
  }

  // Build URL: BJs_BASE_URL/BJs_GetMenuItemList_URL/parsed_category_id/parsed_site_id
  const baseUrl = config.bjsBaseUrl.replace(/\/$/, ''); // Remove trailing slash if present
  const path = config.bjsGetMenuItemListUrl.replace(/^\//, ''); // Remove leading slash if present
  const url = `${baseUrl}/${path}/${parsedCategoryId}/${parsedSiteId}`;

  try {
    const response: AxiosResponse<MenuItemListResponse> = await axios.get(url, {
      headers: {
        SecurityToken: config.bjsSecurityToken
      }
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch menu item list: ${error.message} (Status: ${error.response?.status || 'N/A'})`
      );
    }
    throw error;
  }
}

