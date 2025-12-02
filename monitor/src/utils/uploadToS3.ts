import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { config } from '../config';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

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

