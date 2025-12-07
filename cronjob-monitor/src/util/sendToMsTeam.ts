import { uploadFileToS3 } from './uploadToS3';
import { config } from '../config';

/**
 * Build a cell for adaptive card table
 * @param fieldValue The field value
 * @param style The cell style (default: "good")
 * @returns TableCell object
 */
function buildTableCell(fieldValue: any, style: string = "good") {
  // Handle image fields
  if (fieldValue && typeof fieldValue === 'object' && 'type' in fieldValue && fieldValue.type === 'image' && fieldValue.value) {
    return {
      type: "TableCell",
      style,
      items: [
        {
          type: "Image",
          url: String(fieldValue.value),
          size: "Auto",
          selectAction: {
            type: "Action.OpenUrl",
            url: String(fieldValue.value),
          },
        },
      ],
    };
  }

  // Handle text fields
  const textValue = fieldValue == null ? '' : String(fieldValue);
  return {
    type: "TableCell",
    style,
    items: [
      {
        type: "TextBlock",
        size: "small",
        text: textValue,
        wrap: true,
      },
    ],
  };
}

/**
 * Build an adaptive card with product information
 * @param title The title of the card
 * @param data Array of product data objects with: locationId, locationName, categoryId, categoryName, productId, productName, screenshotUrl
 * @returns Adaptive card object
 */
export function buildProductAdaptiveCard(
  title: string,
  data: Array<{
    locationId: string;
    locationName: string;
    categoryId: string;
    categoryName: string;
    productId: string;
    productName: string;
    screenshotUrl: string;
  }>
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

  // Build table rows from data
  const rows = data.map((row) => ({
    type: "TableRow",
    cells: [
      buildTableCell(`${row.locationId}: ${row.locationName}`),
      buildTableCell(`${row.categoryId}: ${row.categoryName}`),
      buildTableCell(`${row.productId}: ${row.productName}`),
      buildTableCell({ type: 'image', value: row.screenshotUrl }),
    ],
  }));

  // Build table header
  const header = {
    type: "TableRow",
    cells: [
      'Location',
      'Category',
      'Product',
      'Screenshot'
    ].map((headerText) => ({
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

  // Calculate column widths (4 columns)
  // First column (Location) is 50% of its original width (12.5% instead of 25%)
  // Remaining width (87.5%) is distributed among the other 3 columns
  const columns = [
    { width: 10 },  // Location - reduced by 50%
    { width: 20 }, // Category
    { width: 20 }, // Product
    { width: 50 }, // Screenshot
  ];

  // Add table to body
  body.push({
    type: "Table",
    gridStyle: "accent",
    firstRowAsHeaders: true,
    columns,
    rows: [header, ...rows],
  });

  // Build the adaptive card
  const adaptiveCard = {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    msteams: {
      width: "Full",
    },
    body,
  };

  return adaptiveCard;
}

/**
 * Send an adaptive card to MS Teams webhook
 * @param cardBody The adaptive card body object
 * @param webhookUrl Optional webhook URL (defaults to MS_TEAM_WEBHOOK_URL from config)
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

  console.log('Sending to MS Teams webhook. Message structure:', {
    type: message.type,
    attachmentsCount: message.attachments.length,
    contentType: message.attachments[0]?.contentType,
    cardType: message.attachments[0]?.content?.type,
    cardVersion: message.attachments[0]?.content?.version,
    bodyItemsCount: message.attachments[0]?.content?.body?.length
  });

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
    console.error('MS Teams webhook error response:', {
      status: response.status,
      statusText: response.statusText,
      errorText: errorText,
      messageSent: JSON.stringify(message, null, 2)
    });
    throw new Error(`Failed to send message to MS Teams: ${response.status} ${response.statusText}. ${errorText}`);
  }

  console.log('Message sent to MS Teams successfully');
}

/**
 * Upload screenshot to S3, build adaptive card, and send to MS Teams
 * @param title The title of the card
 * @param data Array of product data objects with: locationId, locationName, categoryId, categoryName, productId, productName, screenshotPath
 * @param webhookUrl Optional webhook URL (defaults to MS_TEAM_WEBHOOK_URL from config)
 * @returns Promise that resolves when message is sent
 */
export async function uploadScreenshotsAndSendToMsTeams(
  title: string,
  data: Array<{
    locationId: string;
    locationName: string;
    categoryId: string;
    categoryName: string;
    productId: string;
    productName: string;
    screenshotPath: string;
  }>,
  webhookUrl?: string
): Promise<void> {
  // Upload all screenshots to S3 and get URLs
  const dataWithUrls = await Promise.all(
    data.map(async (item) => {
      const screenshotUrl = await uploadFileToS3(item.screenshotPath);
      return {
        locationId: item.locationId,
        locationName: item.locationName,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        productId: item.productId,
        productName: item.productName,
        screenshotUrl,
      };
    })
  );

  // Build adaptive card
  const card = buildProductAdaptiveCard(title, dataWithUrls);

  // Send to MS Teams
  await sendAdaptiveCardToMsTeams(card, webhookUrl);
}

