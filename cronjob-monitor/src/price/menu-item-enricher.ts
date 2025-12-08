import { getMenuItemList } from '../util/bjs';
import { PriceChange, MenuItemInfo } from '../types';

/**
 * Enrich added and modified prices with menu item information from BJs API
 * @param changes Array of price changes (added and/or modified)
 * @returns Promise with enriched price changes
 */
export async function enrichAddedPricesWithMenuItems(
  changes: PriceChange[]
): Promise<PriceChange[]> {
  const enriched: PriceChange[] = [];
  
  // Group by site and category to minimize API calls
  const apiCallCache = new Map<string, MenuItemInfo[]>();
  
  for (const change of changes) {
    const enrichedChange = { ...change };
    
    // Enrich if it's an added or modified price with valid parsed IDs
    if (
      (change.changeType === 'added' || change.changeType === 'modified') &&
      change.after.productParsed?.id &&
      change.after.locationParsed?.id &&
      change.after.categoryParsed?.id
    ) {
      const siteId = change.after.locationParsed.id;
      const categoryId = change.after.categoryParsed.id;
      const productId = change.after.productParsed.id;
      const cacheKey = `${siteId}-${categoryId}`;
      
      try {
        // Check cache first
        let menuItems: MenuItemInfo[] | undefined = apiCallCache.get(cacheKey);
        
        if (!menuItems) {
          // Fetch menu items from API
          console.log(`Fetching menu items for site ${siteId}, category ${categoryId}...`);
          const response = await getMenuItemList(categoryId, siteId);
          menuItems = response.GetMenuItemListResult?.Data || [];
          apiCallCache.set(cacheKey, menuItems);
        }
        
        // Find the menu item matching the product ID
        const menuItem = menuItems.find(
          (item: MenuItemInfo) => item.ItemId === productId
        );
        
        if (menuItem) {
          enrichedChange.menuItemInfo = menuItem;
        } else {
          console.warn(
            `Menu item not found for product ID ${productId} in site ${siteId}, category ${categoryId}`
          );
        }
      } catch (error) {
        console.error(
          `Failed to fetch menu items for site ${siteId}, category ${categoryId}:`,
          error instanceof Error ? error.message : error
        );
        // Continue without menu item info
      }
    }
    
    enriched.push(enrichedChange);
  }
  
  return enriched;
}

