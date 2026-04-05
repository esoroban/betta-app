import fs from "fs";
import path from "path";

/**
 * Persistent storage for uploaded/generated images.
 *
 * On Render: /app/storage (persistent disk, survives redeploy)
 * In dev: ./storage (local folder in project root)
 *
 * Structure:
 *   /app/storage/candidates/{candidateId}.png  — candidate images
 *   /app/storage/published/{lessonId}/         — published assets
 */

function getStorageRoot(): string {
  return process.env.STORAGE_PATH || path.join(process.cwd(), "storage");
}

export function getCandidatesDir(): string {
  const dir = path.join(getStorageRoot(), "candidates");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getPublishedDir(lessonId: string): string {
  const dir = path.join(getStorageRoot(), "published", lessonId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveCandidateImage(candidateId: string, buffer: Buffer, ext = ".png"): string {
  const dir = getCandidatesDir();
  const filename = `${candidateId}${ext}`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);
  return filename;
}

export function getCandidateImagePath(filename: string): string | null {
  const filePath = path.join(getCandidatesDir(), filename);
  if (!fs.existsSync(filePath)) return null;
  return filePath;
}

export function getStorageInfo(): { root: string; exists: boolean; candidateCount: number } {
  const root = getStorageRoot();
  const exists = fs.existsSync(root);
  let candidateCount = 0;
  const candDir = path.join(root, "candidates");
  if (fs.existsSync(candDir)) {
    candidateCount = fs.readdirSync(candDir).length;
  }
  return { root, exists, candidateCount };
}
