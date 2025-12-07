import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { config } from '../config';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
export function buildS3BaseUrl(
  s3Prefix: string,
  prefix: string,
  filename?: string
): string {
  // Build the full prefix: s3Prefix/customPrefix or just customPrefix if s3Prefix is empty
  let fullPath = `${s3Prefix}/${prefix}`;
  
  if (filename) {
    fullPath = `${fullPath}/${filename}`;
  }
  
  // Build public S3 URL for screenshots using BASE_S3_URL from .env
  if (config.baseS3Url) {
    // Use BASE_S3_URL if provided, ensuring it ends with a slash
    const baseUrl = config.baseS3Url.endsWith('/') ? config.baseS3Url : `${config.baseS3Url}/`;
    return `${baseUrl}${fullPath}`;
  }
  
  // Fallback to manual construction if BASE_S3_URL is not set
  if (config.s3Endpoint) {
    // Custom endpoint (e.g., MinIO, DigitalOcean Spaces)
    if (config.s3ForcePathStyle) {
      return `${config.s3Endpoint}/${config.s3Bucket}/${fullPath}`;
    } else {
      return `${config.s3Endpoint}/${fullPath}`;
    }
  }
  
  // Standard AWS S3
  if (config.s3ForcePathStyle) {
    return `https://s3.${config.awsRegion}.amazonaws.com/${config.s3Bucket}/${fullPath}`;
  } else {
    return `https://${config.s3Bucket}.s3.${config.awsRegion}.amazonaws.com/${fullPath}`;
  }
}
/**
 * Upload a single file to S3 and return its URL
 * @param filePath Path to the file to upload
 * @param s3Key Optional S3 key (if not provided, uses filename with prefix)
 * @returns Promise that resolves to the S3 URL of the uploaded file
 */
export async function uploadFileToS3(filePath: string, s3Key?: string): Promise<string> {
  // Validate S3 configuration
  if (!config.awsAccessKeyId || !config.awsSecretAccessKey || !config.s3Bucket) {
    throw new Error('AWS credentials and S3 bucket must be set in .env file (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET)');
  }

  // Resolve the file path
  const resolvedFilePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  // Check if file exists
  if (!fs.existsSync(resolvedFilePath)) {
    throw new Error(`File not found: ${resolvedFilePath}`);
  }

  const stats = fs.statSync(resolvedFilePath);
  if (!stats.isFile()) {
    throw new Error(`Path is not a file: ${resolvedFilePath}`);
  }

  // Determine S3 key
  const fileName = path.basename(resolvedFilePath);
  const s3Prefix = config.s3Prefix || '';
  const finalS3Key = s3Key || (s3Prefix ? `${s3Prefix.replace(/\/$/, '')}/${fileName}` : fileName);
  
  // Extract prefix and filename from finalS3Key for buildS3BaseUrl
  // buildS3BaseUrl expects: s3Prefix (from config), prefix (additional path), filename
  // The finalS3Key might already include s3Prefix, so we need to extract the remaining part
  let urlPrefix = '';
  let urlFilename = fileName;
  
  // Normalize s3Prefix (remove trailing slash)
  const normalizedS3Prefix = s3Prefix.replace(/\/$/, '');
  
  // Check if finalS3Key starts with s3Prefix
  if (normalizedS3Prefix && finalS3Key.startsWith(normalizedS3Prefix + '/')) {
    // Remove s3Prefix from the key to get the remaining path
    const remainingKey = finalS3Key.substring(normalizedS3Prefix.length + 1);
    const lastSlashIndex = remainingKey.lastIndexOf('/');
    if (lastSlashIndex !== -1) {
      urlPrefix = remainingKey.substring(0, lastSlashIndex);
      urlFilename = remainingKey.substring(lastSlashIndex + 1);
    } else {
      // No prefix, just filename
      urlPrefix = '';
      urlFilename = remainingKey;
    }
  } else {
    // finalS3Key doesn't start with s3Prefix, treat it as prefix+filename
    const lastSlashIndex = finalS3Key.lastIndexOf('/');
    if (lastSlashIndex !== -1) {
      urlPrefix = finalS3Key.substring(0, lastSlashIndex);
      urlFilename = finalS3Key.substring(lastSlashIndex + 1);
    } else {
      // No prefix, just filename
      urlPrefix = '';
      urlFilename = finalS3Key;
    }
  }

  // Initialize S3 client
  const s3ClientConfig: any = {
    region: config.awsRegion,
    credentials: {
      accessKeyId: config.awsAccessKeyId,
      secretAccessKey: config.awsSecretAccessKey,
    },
  };

  // Add endpoint if specified
  if (config.s3Endpoint) {
    s3ClientConfig.endpoint = config.s3Endpoint;
  }

  // Use path-style addressing if required
  if (config.s3ForcePathStyle) {
    s3ClientConfig.forcePathStyle = true;
  }

  const s3Client = new S3Client(s3ClientConfig);

  // Read file content
  const fileContent = fs.readFileSync(resolvedFilePath);

  // Determine content type based on file extension
  const ext = path.extname(fileName).toLowerCase();
  let contentType = 'application/octet-stream';
  if (ext === '.png') {
    contentType = 'image/png';
  } else if (ext === '.jpg' || ext === '.jpeg') {
    contentType = 'image/jpeg';
  }

  // Upload to S3
  const command = new PutObjectCommand({
    Bucket: config.s3Bucket,
    Key: finalS3Key,
    Body: fileContent,
    ContentType: contentType,
    ContentDisposition: 'inline',
  });

  try {
    await s3Client.send(command);
    console.log(`Uploaded to S3: ${finalS3Key}`);
  } catch (error: any) {
    // Handle PermanentRedirect error
    if (error.name === 'PermanentRedirect' || error.$metadata?.httpStatusCode === 301) {
      const endpoint = error.$metadata?.httpHeaders?.['x-amz-bucket-region'] || error.$metadata?.httpHeaders?.['location'];
      throw new Error(
        `S3 bucket region mismatch. The bucket "${config.s3Bucket}" is in a different region. ` +
        `Please update AWS_REGION in your .env file. ` +
        (endpoint ? `Suggested endpoint: ${endpoint}` : '') +
        `\nOriginal error: ${error.message}`
      );
    }
    throw error;
  }

  // Build and return S3 URL using buildS3BaseUrl
  // buildS3BaseUrl constructs: s3Prefix/prefix/filename
  // If prefix is empty, it constructs: s3Prefix//filename (double slash, but that's handled by the function)
  return buildS3BaseUrl(normalizedS3Prefix, urlPrefix, urlFilename);
}

/**
 * Upload a folder to S3 bucket
 * @param folderPath Path to the folder to upload (relative or absolute)
 * @param prefix Optional S3 prefix to prepend to the folder path (e.g., "my-custom-prefix")
 * @returns Promise that resolves when upload is complete
 */
export async function uploadFolderToS3(folderPath: string, prefix?: string): Promise<void> {
  // Validate S3 configuration
  if (!config.awsAccessKeyId || !config.awsSecretAccessKey || !config.s3Bucket) {
    throw new Error('AWS credentials and S3 bucket must be set in .env file (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET)');
  }

  // Resolve the folder path
  const resolvedFolderPath = path.isAbsolute(folderPath)
    ? folderPath
    : path.resolve(process.cwd(), folderPath);

  // Check if folder exists
  if (!fs.existsSync(resolvedFolderPath)) {
    throw new Error(`Folder not found: ${resolvedFolderPath}`);
  }

  const stats = fs.statSync(resolvedFolderPath);
  if (!stats.isDirectory()) {
    throw new Error(`Path is not a directory: ${resolvedFolderPath}`);
  }

  // Get the folder name
  const folderName = path.basename(resolvedFolderPath);

  // Initialize S3 client with endpoint and path style configuration
  const s3ClientConfig: any = {
    region: config.awsRegion,
    credentials: {
      accessKeyId: config.awsAccessKeyId,
      secretAccessKey: config.awsSecretAccessKey,
    },
  };

  // Add endpoint if specified (for custom S3-compatible services or specific regions)
  if (config.s3Endpoint) {
    s3ClientConfig.endpoint = config.s3Endpoint;
  }

  // Use path-style addressing if required (for some S3-compatible services)
  if (config.s3ForcePathStyle) {
    s3ClientConfig.forcePathStyle = true;
  }

  const s3Client = new S3Client(s3ClientConfig);

  // Recursively get all files in the folder
  const files = getAllFiles(resolvedFolderPath);
  console.log(`Found ${files.length} file(s) to upload from folder: ${folderName}`);

  // Build S3 key prefix (custom prefix + folder name)
  const s3Prefix = prefix || config.s3Prefix || '';
  const baseKey = s3Prefix ? `${s3Prefix.replace(/\/$/, '')}/${folderName}` : folderName;

  // Upload each file
  const uploadPromises = files.map(async (filePath) => {
    // Get relative path from the folder root
    const relativePath = path.relative(resolvedFolderPath, filePath);
    // Create S3 key with prefix and folder name
    const s3Key = `${baseKey}/${relativePath.replace(/\\/g, '/')}`;

    // Read file content
    const fileContent = fs.readFileSync(filePath);

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: s3Key,
      Body: fileContent,
      ContentType: 'image/png',
      ContentDisposition: 'inline',
    });

    try {
      await s3Client.send(command);
      console.log(`Uploaded: ${s3Key}`);
    } catch (error: any) {
      // Handle PermanentRedirect error
      if (error.name === 'PermanentRedirect' || error.$metadata?.httpStatusCode === 301) {
        const endpoint = error.$metadata?.httpHeaders?.['x-amz-bucket-region'] || error.$metadata?.httpHeaders?.['location'];
        throw new Error(
          `S3 bucket region mismatch. The bucket "${config.s3Bucket}" is in a different region. ` +
          `Please update AWS_REGION in your .env file. ` +
          (endpoint ? `Suggested endpoint: ${endpoint}` : '') +
          `\nOriginal error: ${error.message}`
        );
      }
      throw error;
    }
  });

  // Wait for all uploads to complete
  await Promise.all(uploadPromises);
  const s3Path = s3Prefix ? `s3://${config.s3Bucket}/${s3Prefix}/${folderName}` : `s3://${config.s3Bucket}/${folderName}`;
  console.log(`\nSuccessfully uploaded folder "${folderName}" to S3: ${s3Path}`);
}

/**
 * Recursively get all files in a directory
 * @param dirPath Directory path
 * @returns Array of file paths
 */
function getAllFiles(dirPath: string): string[] {
  const files: string[] = [];
  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Recursively get files from subdirectories
      files.push(...getAllFiles(fullPath));
    } else {
      // Add file to list
      files.push(fullPath);
    }
  }

  return files;
}

// If run directly from command line
if (require.main === module) {
  const folderPath = process.argv[2];
  if (!folderPath) {
    console.error('Usage: ts-node uploadToS3.ts <folder-path>');
    process.exit(1);
  }

  uploadFolderToS3(folderPath)
    .then(() => {
      console.log('Upload completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Upload failed:', error);
      process.exit(1);
    });
}

