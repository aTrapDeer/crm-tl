import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const S3_BUCKET = process.env.S3_BUCKET_NAME || "crm-tlcorp";
const AWS_REGION = process.env.AWS_REGION || "us-east-1";

function normalizePrefix(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

const DEFAULT_PROJECT_KEY_PREFIX = normalizePrefix(
  process.env.S3_KEY_PREFIX || "projects/images"
);
const S3_KEY_PREFIXES = {
  project: normalizePrefix(
    process.env.S3_PROJECT_KEY_PREFIX || DEFAULT_PROJECT_KEY_PREFIX
  ),
  work_order: normalizePrefix(
    process.env.S3_WORK_ORDER_KEY_PREFIX || "work-incident-reports/work-orders"
  ),
  incident_report: normalizePrefix(
    process.env.S3_INCIDENT_REPORT_KEY_PREFIX || "work-incident-reports/incident-reports"
  ),
} as const;

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({ region: AWS_REGION });
  }
  return s3Client;
}

function encodeS3Key(key: string): string {
  return key
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export interface UploadResult {
  success: boolean;
  key?: string;
  url?: string;
  error?: string;
}

/**
 * Generate the S3 key (path) for an entity image
 */
export function generateEntityS3Key(
  entityType: keyof typeof S3_KEY_PREFIXES,
  entityId: string,
  filename: string
): string {
  return generateTaggedEntityS3Key(entityType, entityId, null, filename);
}

export function generateTaggedEntityS3Key(
  entityType: keyof typeof S3_KEY_PREFIXES,
  entityId: string,
  tag: string | null,
  filename: string
): string {
  const sanitizedEntityId = entityId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const timestamp = Date.now();
  const sanitizedTag = tag ? tag.replace(/[^a-zA-Z0-9/_-]/g, "_").replace(/^\/+|\/+$/g, "") : "";
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const baseKey = `${S3_KEY_PREFIXES[entityType]}/${sanitizedEntityId}`;
  return sanitizedTag
    ? `${baseKey}/${sanitizedTag}/${timestamp}-${sanitizedFilename}`
    : `${baseKey}/${timestamp}-${sanitizedFilename}`;
}

/**
 * Generate the S3 key (path) for a project image
 * Format: projects/images/{projectId}/{filename}
 */
export function generateS3Key(projectId: string, filename: string): string {
  return generateEntityS3Key("project", projectId, filename);
}

export function getPublicS3Url(key: string): string {
  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${encodeS3Key(key)}`;
}

/**
 * Upload a file to S3 for any supported entity type
 */
export async function uploadEntityFileToS3(
  entityType: keyof typeof S3_KEY_PREFIXES,
  entityId: string,
  filename: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<UploadResult> {
  return uploadTaggedEntityFileToS3(entityType, entityId, null, filename, fileBuffer, contentType);
}

export async function uploadTaggedEntityFileToS3(
  entityType: keyof typeof S3_KEY_PREFIXES,
  entityId: string,
  tag: string | null,
  filename: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<UploadResult> {
  if (!isS3Configured()) {
    return {
      success: false,
      error:
        "S3 is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and S3_BUCKET_NAME.",
    };
  }

  const key = generateTaggedEntityS3Key(entityType, entityId, tag, filename);

  try {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType || "application/octet-stream",
      })
    );

    return {
      success: true,
      key,
      url: getPublicS3Url(key),
    };
  } catch (error) {
    console.error("S3 upload failed:", error);
    return {
      success: false,
      error: "Failed to upload file to S3.",
    };
  }
}

/**
 * Upload a file to S3 for a project image
 */
export async function uploadToS3(
  projectId: string,
  filename: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<UploadResult> {
  return uploadEntityFileToS3(
    "project",
    projectId,
    filename,
    fileBuffer,
    contentType
  );
}

/**
 * Delete a file from S3
 */
export async function deleteFromS3(key: string): Promise<boolean> {
  if (!isS3Configured()) {
    console.warn("S3 is not configured. Skipping object delete:", key);
    return false;
  }

  try {
    await getS3Client().send(
      new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      })
    );
    return true;
  } catch (error) {
    console.error("S3 delete failed:", error);
    return false;
  }
}

/**
 * Generate a presigned URL for temporary access to a private S3 object
 */
export async function getPresignedUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  if (!isS3Configured()) {
    return getPublicS3Url(key);
  }

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });
  return getSignedUrl(getS3Client(), command, { expiresIn });
}

/**
 * Check if S3 is configured and ready to use
 */
export function isS3Configured(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_REGION &&
    process.env.S3_BUCKET_NAME
  );
}

