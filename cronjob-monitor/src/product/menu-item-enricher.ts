import { getMenuItemList } from '../util/bjs';
import { ProductChange, MenuItemInfo } from '../types';

/**
 * Enrich added products with menu item information from BJs API
 * @param addedChanges Array of added product changes
 * @returns Promise with enriched product changes
 */
export async function enrichAddedProductsWithMenuItems(
  addedChanges: ProductChange[]
): Promise<ProductChange[]> {
  const enriched: ProductChange[] = [];
  
  // Group by site and category to minimize API calls
  const apiCallCache = new Map<string, MenuItemInfo[]>();
  
  for (const change of addedChanges) {
    const enrichedChange = { ...change };
    
    // Only enrich if it's an added product with valid parsed IDs
    if (
      change.changeType === 'added' &&
      change.friday.productParsed?.id &&
      change.friday.locationParsed?.id &&
      change.friday.categoryParsed?.id
    ) {
      const siteId = change.friday.locationParsed.id;
      const categoryId = change.friday.categoryParsed.id;
      const productId = change.friday.productParsed.id;
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

