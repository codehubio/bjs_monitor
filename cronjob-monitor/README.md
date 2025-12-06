# Cronjob Monitor

This project monitors and analyzes product changes between consecutive days (Thursday and Friday) from CSV files.

## Project Structure

```
cronjob-monitor/
├── csv/
│   ├── products.csv          # Product changes between Thursday and Friday
│   └── sub-attributes.csv    # (To be processed)
├── result/
│   └── products-changes.json # JSON output of processed changes
├── src/
│   ├── types.ts              # TypeScript type definitions
│   ├── csv-parser.ts         # CSV parsing utilities
│   └── process-products.ts   # Main processing logic for products
├── package.json
├── tsconfig.json
└── README.md
```

## CSV Format

The `products.csv` file contains product changes between two consecutive days:

- **Row 1**: Header row with "Thursday,,,Friday,,"
- **Row 2**: Column headers "Location,Category,Product,Location,Category,Product"
- **Rows 3+**: Data rows with:
  - Left 3 columns: Location, Category, Product (for Thursday)
  - Right 3 columns: Location, Category, Product (for Friday)

## Change Types

The script categorizes changes into four types:

1. **Added**: Product exists on Friday but not on Thursday
2. **Removed**: Product exists on Thursday but not on Friday
3. **Modified**: Product exists on both days but with different product IDs (same location/category)
4. **Moved**: Product exists on both days but in different location or category

## Usage

### Install Dependencies

```bash
npm install
```

### Process Products CSV

```bash
npm run process:products
```

This will:
- Parse the `csv/products.csv` file
- Categorize all changes
- Save the results as JSON to `result/products-changes.json`
- Display a summary and detailed breakdown of all changes in the console

## Output Example

```
Processing products CSV: /path/to/csv/products.csv

Total rows found: 24

=== PRODUCT CHANGES SUMMARY ===

Added: 16
Removed: 7
Modified: 1
Moved: 0
Total changes: 24

=== ADDED PRODUCTS ===
[ADDED] 418: West Covina | 137: Cocktails - 379: Seasonal | 4011: Patron Margarita Tree
...

=== REMOVED PRODUCTS ===
[REMOVED] 479: Southcenter Mall | 11: Desserts | 171: BJ's Handcrafted Root Beer Float
...

✅ Changes saved to: /path/to/result/products-changes.json
```

## JSON Output

The script automatically saves all changes to a JSON file in the `result/` folder. The JSON structure includes:

- **summary**: Counts of each change type
- **changes**: Detailed arrays of all changes categorized by type:
  - `added`: Products added on Friday
  - `removed`: Products removed from Thursday
  - `modified`: Products with different IDs but same location/category
  - `moved`: Products that changed location or category
  - `all`: All changes combined

Each change entry includes:
- `thursday`: Location, category, and product for Thursday
- `friday`: Location, category, and product for Friday
- `changeType`: Type of change (added, removed, modified, moved)

## Development

### Build TypeScript

```bash
npm run build
```

### Run with ts-node

```bash
npm start
```

