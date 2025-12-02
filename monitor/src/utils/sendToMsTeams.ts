import { config } from '../config';

/**
 * Build a cell for adaptive card table, supporting both text and image fields
 * @param fieldValue The field value - can be a string or an object with {type, value}
 * @param style The cell style (default: "good")
 * @returns TableCell object
 */
function buildTableCell(fieldValue: any, style: string = "good") {
  // Check if fieldValue is a structured field with type and value
  let fieldType: string;
  let value: any;
  
  if (fieldValue && typeof fieldValue === 'object' && 'type' in fieldValue && 'value' in fieldValue) {
    // Structured field format: { type: "text" | "image", value: ... }
    fieldType = fieldValue.type;
    value = fieldValue.value;
  } else {
    // Plain value format (backward compatibility)
    fieldType = 'text';
    value = fieldValue;
  }

  // Handle image fields - show as clickable image that can be enlarged
  if (fieldType === 'image' && value) {
    return {
      type: "TableCell",
      style,
      items: [
        {
          type: "Image",
          url: String(value),
          size: "Auto",
          selectAction: {
            type: "Action.OpenUrl",
            url: String(value),
          },
        },
      ],
    };
  }

  // Handle text fields - show as text
  return {
    type: "TableCell",
    style,
    items: [
      {
        type: "TextBlock",
        size: "small",
        text: String(value || ''),
        wrap: true,
      },
    ],
  };
}

/**
 * Build an adaptive card body with a table
 * @param title The title of the card
 * @param urls Optional array of URLs to add as action buttons
 * @param tableData Array of row data objects
 * @param headers Array of header labels
 * @returns Adaptive card object
 */
export function buildAdaptiveCard(
  title: string,
  tableData: Record<string, any>[],
  headers: string[],
  urls: string[] = []
) {
  // Build table rows from data
  const rows = tableData.map((row) => {
    const cells = headers.map((header) => {
      const fieldValue = row[header] || '';
      return buildTableCell(fieldValue);
    });
    return {
      type: "TableRow",
      cells,
    };
  });

  // Build table header
  const header = {
    type: "TableRow",
    cells: headers.map((headerText) => ({
      type: "TableCell",
      items: [
        {
          type: "TextBlock",
          size: "small",
          text: headerText,
          wrap: true,
          weight: "Bolder",
        },
      ],
    })),
    style: "accent",
  };

  // Build action buttons from URLs
  const actions = urls.map((url) => ({
    type: "Action.OpenUrl",
    title: "View the link",
    url,
  }));

  // Build the adaptive card
  const adaptiveCard = {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    msteams: {
      width: "Full",
    },
    ...(actions.length > 0 && { actions }),
    body: [
      {
        type: "TextBlock",
        size: "large",
        text: title,
        weight: "bolder",
        color: "attention",
        style: "heading",
        wrap: true,
      },
      {
        type: "Table",
        gridStyle: "accent",
        firstRowAsHeaders: true,
        columns: [ {
          width: 5,
        }, {
          width: 10,
        }, {
          width: 15,
        }, {
          width: 70,
        }],
        rows: [header, ...rows],
      },
    ],
  };

  return adaptiveCard;
}

/**
 * Send an adaptive card to MS Teams webhook
 * @param cardBody The adaptive card body object
 * @param webhookUrl Optional webhook URL (defaults to MS_TEAM_WEBHOOK_URL from .env)
 * @returns Promise that resolves when message is sent
 */
export async function sendAdaptiveCardToMsTeams(
  cardBody: any,
  webhookUrl?: string
): Promise<void> {
  const url = webhookUrl || config.msTeamWebhookUrl;

  if (!url) {
    throw new Error('MS Teams webhook URL must be provided or set in .env file (MS_TEAM_WEBHOOK_URL)');
  }

  // MS Teams webhook expects the card in a message format
  const message = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: cardBody,
      },
    ],
  };

  // Send to MS Teams webhook
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send message to MS Teams: ${response.status} ${response.statusText}. ${errorText}`);
  }

  console.log('Message sent to MS Teams successfully');
}

/**
 * Build and send an adaptive card to MS Teams in one call
 * @param title The title of the card
 * @param tableData Array of row data objects
 * @param headers Array of header labels
 * @param urls Optional array of URLs to add as action buttons
 * @param webhookUrl Optional webhook URL (defaults to MS_TEAM_WEBHOOK_URL from .env)
 */
export async function buildAndSendAdaptiveCard(
  title: string,
  tableData: Record<string, any>[],
  headers: string[],
  urls: string[] = [],
  webhookUrl?: string
): Promise<void> {
  const card = buildAdaptiveCard(title, tableData, headers, urls);
  await sendAdaptiveCardToMsTeams(card, webhookUrl);
}

/**
 * Build an adaptive card for results with screenshot, total, and grouped data by one column
 * @param title The title of the card
 * @param results Array of result objects from test
 * @param groupByColumn The column name used for grouping (e.g., 'eapi_err_desc', 'userflow_action')
 * @param urls Optional array of URLs to add as action buttons
 * @returns Adaptive card object
 */
export function buildGroup1ColumnAdaptiveCard(
  title: string,
  results: Array<{
    name: { type: string; value: string };
    total: { type: string; value: number | null };
    groupedData: { type: string; value: any[] };
    queryIndex: { type: string; value: number };
    screenshot: { type: string; value: string };
    description?: { type: string; value: string };
  }>,
  groupByColumn: string,
  urls: string[] = []
) {
  const body: any[] = [
    {
      type: "TextBlock",
      size: "large",
      text: title,
      weight: "bolder",
      color: "attention",
      style: "heading",
      wrap: true,
    },
  ];

  // Process each result
  for (const result of results) {
    // First row: Screenshot (100% width)
    const screenshotValue = result.screenshot.value;
    if (screenshotValue) {
      body.push({
        type: "Image",
        url: String(screenshotValue),
        size: "Auto",
        selectAction: {
          type: "Action.OpenUrl",
          url: String(screenshotValue),
        },
        spacing: "medium",
      });
    }

    // Description row (100% width) - only display if description exists and is not empty
    const descriptionValue = result.description?.value;
    if (descriptionValue && descriptionValue.trim() !== '') {
      body.push({
        type: "TextBlock",
        size: "medium",
        text: String(descriptionValue),
        wrap: true,
        spacing: "medium",
      });
    }

    // Total EAPI Calls row (100% width)
    const totalValue = result.total.value;
    body.push({
      type: "TextBlock",
      size: "medium",
      text: `Total EAPI Calls: ${totalValue ?? 'N/A'}`,
      weight: "Bolder",
      wrap: true,
      spacing: "medium",
    });

    // Third row: Grouped Data in 3 columns
    const groupedData = result.groupedData.value || [];
    if (groupedData.length > 0) {
      // Create a table for grouped data
      const groupedRows = groupedData.map((item: any) => ({
        type: "TableRow",
        cells: [
          {
            type: "TableCell",
            items: [
              {
                type: "TextBlock",
                size: "small",
                text: String(item[groupByColumn] || '(Unknown)'),
                wrap: true,
              },
            ],
          },
          {
            type: "TableCell",
            items: [
              {
                type: "TextBlock",
                size: "small",
                text: String(item.count || 0),
                wrap: true,
              },
            ],
          },
          {
            type: "TableCell",
            items: [
              {
                type: "TextBlock",
                size: "small",
                text: `${((item.count || 0) / (totalValue || 1) * 100).toFixed(2)}%`,
                wrap: true,
              },
            ],
          },
        ],
      }));

      body.push({
        type: "Table",
        gridStyle: "accent",
        firstRowAsHeaders: true,
        columns: [
          { width: 60 }, // Error description
          { width: 20 }, // Count
          { width: 20 }, // Percentage
        ],
        rows: [
          {
            type: "TableRow",
            cells: [
              {
                type: "TableCell",
                items: [
                  {
                    type: "TextBlock",
                    size: "small",
                    text: groupByColumn.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                    wrap: true,
                    weight: "Bolder",
                  },
                ],
              },
              {
                type: "TableCell",
                items: [
                  {
                    type: "TextBlock",
                    size: "small",
                    text: "Count",
                    wrap: true,
                    weight: "Bolder",
                  },
                ],
              },
              {
                type: "TableCell",
                items: [
                  {
                    type: "TextBlock",
                    size: "small",
                    text: "Percentage",
                    wrap: true,
                    weight: "Bolder",
                  },
                ],
              },
            ],
            style: "accent",
          },
          ...groupedRows,
        ],
        spacing: "medium",
      });
    }

    // Add separator between results
    if (result !== results[results.length - 1]) {
      body.push({
        type: "Separator",
        spacing: "large",
      });
    }
  }

  // Build action buttons from URLs
  const actions = urls.map((url) => ({
    type: "Action.OpenUrl",
    title: "View the link",
    url,
  }));

  // Build the adaptive card
  const adaptiveCard = {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    msteams: {
      width: "Full",
    },
    ...(actions.length > 0 && { actions }),
    body,
  };

  return adaptiveCard;
}

/**
 * Build and send results adaptive card with grouped data by one column to MS Teams
 * @param title The title of the card
 * @param results Array of result objects from test
 * @param groupByColumn The column name used for grouping (e.g., 'eapi_err_desc', 'userflow_action')
 * @param urls Optional array of URLs to add as action buttons
 * @param webhookUrl Optional webhook URL (defaults to MS_TEAM_WEBHOOK_URL from .env)
 */
export async function buildAndSendGroup1ColumnAdaptiveCard(
  title: string,
  results: Array<{
    name: { type: string; value: string };
    total: { type: string; value: number | null };
    groupedData: { type: string; value: any[] };
    queryIndex: { type: string; value: number };
    screenshot: { type: string; value: string };
    description?: { type: string; value: string };
  }>,
  groupByColumn: string,
  urls: string[] = [],
  webhookUrl?: string
): Promise<void> {
  const card = buildGroup1ColumnAdaptiveCard(title, results, groupByColumn, urls);
  await sendAdaptiveCardToMsTeams(card, webhookUrl);
}

/**
 * Build an adaptive card for results with screenshot, total, and grouped data by two columns
 * @param title The title of the card
 * @param results Array of result objects from test
 * @param groupByColumn1 The first column name used for grouping (e.g., 'eapi_err_desc')
 * @param groupByColumn2 The second column name used for grouping (e.g., 'eapi_cor_id')
 * @param urls Optional array of URLs to add as action buttons
 * @param additionalSubTableColumns Optional array of additional column names to display in sub-table rows (e.g., ['eapi_customer_id', 'eapi_loyalty_id'])
 * @returns Adaptive card object
 */
export function buildGroup2ColumnAdaptiveCard(
  title: string,
  results: Array<{
    name: { type: string; value: string };
    total: { type: string; value: number | null };
    groupedData: { type: string; value: any[] };
    queryIndex: { type: string; value: number };
    screenshot: { type: string; value: string };
    description?: { type: string; value: string };
  }>,
  groupByColumn1: string,
  groupByColumn2: string,
  urls: string[] = [],
  additionalSubTableColumns: string[] = []
) {
  const body: any[] = [
    {
      type: "TextBlock",
      size: "large",
      text: title,
      weight: "bolder",
      color: "attention",
      style: "heading",
      wrap: true,
    },
  ];

  // Process each result
  for (const result of results) {
    // First row: Screenshot (100% width)
    const screenshotValue = result.screenshot.value;
    if (screenshotValue) {
      body.push({
        type: "Image",
        url: String(screenshotValue),
        size: "Auto",
        selectAction: {
          type: "Action.OpenUrl",
          url: String(screenshotValue),
        },
        spacing: "medium",
      });
    }

    // Description row (100% width) - only display if description exists and is not empty
    const descriptionValue = result.description?.value;
    if (descriptionValue && descriptionValue.trim() !== '') {
      body.push({
        type: "TextBlock",
        size: "medium",
        text: String(descriptionValue),
        wrap: true,
        spacing: "medium",
      });
    }

    // Total EAPI Calls row (100% width)
    const totalValue = result.total.value;
    body.push({
      type: "TextBlock",
      size: "medium",
      text: `Total EAPI Calls: ${totalValue ?? 'N/A'}`,
      weight: "Bolder",
      wrap: true,
      spacing: "medium",
    });

    // Third row: Grouped Data in a single table
    const groupedData = result.groupedData.value || [];
    if (groupedData.length > 0) {
      // Group data by column 1
      const groupedByColumn1: { [key: string]: any[] } = {};
      for (const item of groupedData) {
        const column1Value = String(item[groupByColumn1] || '(Unknown)');
        if (!groupedByColumn1[column1Value]) {
          groupedByColumn1[column1Value] = [];
        }
        groupedByColumn1[column1Value].push(item);
      }

      // Build table rows: group header rows and detail rows
      const tableRows: any[] = [];
      
      for (const [column1Value, items] of Object.entries(groupedByColumn1)) {
        // Calculate total for this group
        const groupTotal = items.reduce((sum, item) => sum + (item.count || 0), 0);
        
        // Row: Group header - First cell: label and value combined, middle cells empty, last cell: total
        const groupHeaderCells: any[] = [];
        
        // Format column name for display
        const column1Label = groupByColumn1.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
        
        // First cell: group column 1 label and value combined
        groupHeaderCells.push({
          type: "TableCell",
          items: [
            {
              type: "TextBlock",
              size: "small",
              text: `${column1Label}: ${String(column1Value)}`,
              wrap: true,
              weight: "Bolder",
            },
          ],
          style: "good", // Green color to distinguish the row
        });
        
        // Empty cells for additional columns (to align with detail rows)
        for (let i = 0; i < additionalSubTableColumns.length; i++) {
          groupHeaderCells.push({
            type: "TableCell",
            items: [
              {
                type: "TextBlock",
                size: "small",
                text: "",
                wrap: true,
              },
            ],
            style: "good", // Green color to distinguish the row
          });
        }
        
        // Last cell: total
        groupHeaderCells.push({
          type: "TableCell",
          items: [
            {
              type: "TextBlock",
              size: "small",
              text: `Total: ${String(groupTotal)}`,
              wrap: true,
              weight: "Bolder",
            },
          ],
          style: "good", // Green color to distinguish the row
        });
        
        tableRows.push({
          type: "TableRow",
          cells: groupHeaderCells,
          style: "good", // Green color for the entire row to distinguish it
        });

        // Detail rows: group column 2, additional columns, then count
        for (const item of items) {
          const cells: any[] = [];
          
          // Column 1: group column 2 value
          cells.push({
            type: "TableCell",
            items: [
              {
                type: "TextBlock",
                size: "small",
                text: String(item[groupByColumn2] || '(Unknown)'),
                wrap: true,
              },
            ],
          });
          
          // Additional columns if specified
          for (const col of additionalSubTableColumns) {
            cells.push({
              type: "TableCell",
              items: [
                {
                  type: "TextBlock",
                  size: "small",
                  text: String(item[col] || '(Unknown)'),
                  wrap: true,
                },
              ],
            });
          }
          
          // Last column: count
          cells.push({
            type: "TableCell",
            items: [
              {
                type: "TextBlock",
                size: "small",
                text: String(item.count || 0),
                wrap: true,
              },
            ],
          });
          
          tableRows.push({
            type: "TableRow",
            cells,
          });
        }
      }

      // Build header row with all columns
      // Header structure: groupByColumn1 (for group headers) / groupByColumn2 (for detail rows), additional columns, Count
      const headerCells: any[] = [];
      
      // Header cell 1: Shows both group column 1 and group column 2 labels (since group headers use col1, details use col2)
      const headerText1 = `${groupByColumn1.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} / ${groupByColumn2.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}`;
      headerCells.push({
        type: "TableCell",
        items: [
          {
            type: "TextBlock",
            size: "small",
            text: headerText1,
            wrap: true,
            weight: "Bolder",
          },
        ],
      });
      
      // Additional header cells for additional columns
      for (const col of additionalSubTableColumns) {
        const colHeaderText = col.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
        headerCells.push({
          type: "TableCell",
          items: [
            {
              type: "TextBlock",
              size: "small",
              text: colHeaderText,
              wrap: true,
              weight: "Bolder",
            },
          ],
        });
      }
      
      // Last header cell: Total/Count
      headerCells.push({
        type: "TableCell",
        items: [
          {
            type: "TextBlock",
            size: "small",
            text: "Total / Count",
            wrap: true,
            weight: "Bolder",
          },
        ],
      });
      
      // Calculate column widths dynamically
      const totalColumns = 1 + additionalSubTableColumns.length + 1; // groupByColumn2 + additional columns + count
      const baseWidth = Math.floor(100 / totalColumns);
      const columns = Array(totalColumns).fill(null).map(() => ({ width: baseWidth }));
      
      // Add single table with all rows
      body.push({
        type: "Table",
        gridStyle: "accent",
        firstRowAsHeaders: true,
        columns,
        rows: [
          {
            type: "TableRow",
            cells: headerCells,
            style: "accent",
          },
          ...tableRows,
        ],
        spacing: "medium",
      });
    }

    // Add separator between results
    if (result !== results[results.length - 1]) {
      body.push({
        type: "Separator",
        spacing: "large",
      });
    }
  }

  // Build action buttons from URLs
  const actions = urls.map((url) => ({
    type: "Action.OpenUrl",
    title: "View the link",
    url,
  }));

  // Build the adaptive card
  const adaptiveCard = {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    msteams: {
      width: "Full",
    },
    ...(actions.length > 0 && { actions }),
    body,
  };

  return adaptiveCard;
}

/**
 * Build and send results adaptive card with grouped data by two columns to MS Teams
 * @param title The title of the card
 * @param results Array of result objects from test
 * @param groupByColumn1 The first column name used for grouping (e.g., 'eapi_err_desc')
 * @param groupByColumn2 The second column name used for grouping (e.g., 'eapi_cor_id')
 * @param urls Optional array of URLs to add as action buttons
 * @param additionalSubTableColumns Optional array of additional column names to display in sub-table rows (e.g., ['eapi_customer_id', 'eapi_loyalty_id'])
 * @param webhookUrl Optional webhook URL (defaults to MS_TEAM_WEBHOOK_URL from .env)
 */
export async function buildAndSendGroup2ColumnAdaptiveCard(
  title: string,
  results: Array<{
    name: { type: string; value: string };
    total: { type: string; value: number | null };
    groupedData: { type: string; value: any[] };
    queryIndex: { type: string; value: number };
    screenshot: { type: string; value: string };
    description?: { type: string; value: string };
  }>,
  groupByColumn1: string,
  groupByColumn2: string,
  urls: string[] = [],
  additionalSubTableColumns: string[] = [],
  webhookUrl?: string
): Promise<void> {
  const card = buildGroup2ColumnAdaptiveCard(title, results, groupByColumn1, groupByColumn2, urls, additionalSubTableColumns);
  await sendAdaptiveCardToMsTeams(card, webhookUrl);
}

