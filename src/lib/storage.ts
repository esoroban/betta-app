import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

// S3-compatible storage (Render Object Storage / R2 / AWS S3)
const s3 = process.env.S3_ENDPOINT ? new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "",
    secretAccessKey: process.env.S3_SECRET_KEY || "",
  },
}) : null;

const BUCKET = process.env.S3_BUCKET || "betta-assets";
const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL || "";

// In dev: read from local filesystem. In production: read from S3.
const isLocal = !s3;

// Local paths (dev mode)
function getLocalRoot(): string {
  // From betta-app root, go up to SylaSlova_only_online
  return path.resolve(process.cwd(), "../..");
}

/**
 * Get a file as Buffer — from S3 or local filesystem
 */
export async function getFile(key: string): Promise<Buffer | null> {
  if (isLocal) {
    const localPath = path.join(getLocalRoot(), key);
    if (!fs.existsSync(localPath)) return null;
    return fs.readFileSync(localPath);
  }

  try {
    const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const res = await s3!.send(cmd);
    const bytes = await res.Body?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : null;
  } catch {
    return null;
  }
}

/**
 * Get a JSON file parsed
 */
export async function getJsonFile<T>(key: string): Promise<T | null> {
  const buf = await getFile(key);
  if (!buf) return null;
  return JSON.parse(buf.toString("utf-8"));
}

/**
 * List files in a prefix
 */
export async function listFiles(prefix: string): Promise<string[]> {
  if (isLocal) {
    const dir = path.join(getLocalRoot(), prefix);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).map(f => `${prefix}/${f}`);
  }

  try {
    const cmd = new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix });
    const res = await s3!.send(cmd);
    return (res.Contents || []).map(o => o.Key || "").filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Get public URL for an asset (for <img src>)
 */
export function getPublicUrl(key: string): string {
  if (S3_PUBLIC_URL) {
    return `${S3_PUBLIC_URL}/${key}`;
  }
  // Fallback: serve through our API
  return `/api/assets/${key.replace(/^ASSETS\//, "")}`;
}

/**
 * Check if we're using remote storage
 */
export function isRemoteStorage(): boolean {
  return !isLocal;
}
