#!/usr/bin/env node
/**
 * Upload lesson assets to S3-compatible storage (Render Object Storage / R2 / S3)
 *
 * Usage:
 *   S3_ENDPOINT=... S3_ACCESS_KEY=... S3_SECRET_KEY=... S3_BUCKET=betta-assets \
 *   node scripts/upload-assets.js /path/to/SylaSlova_only_online
 */

const { S3Client, PutObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");

const repoRoot = process.argv[2];
if (!repoRoot) {
  console.error("Usage: node scripts/upload-assets.js /path/to/SylaSlova_only_online");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});

const BUCKET = process.env.S3_BUCKET || "betta-assets";

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json",
};

let uploaded = 0;
let skipped = 0;
let errors = 0;

async function exists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch { return false; }
}

async function upload(localPath, key) {
  const ext = path.extname(localPath).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";

  if (await exists(key)) {
    skipped++;
    return;
  }

  const body = fs.readFileSync(localPath);
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  uploaded++;
  process.stdout.write(`  ✓ ${key} (${(body.length / 1024).toFixed(0)}KB)\n`);
}

async function main() {
  console.log(`Uploading to ${BUCKET} at ${process.env.S3_ENDPOINT}\n`);

  // Upload runtime JSONs
  console.log("=== Runtime JSONs ===");
  const serverDir = path.join(repoRoot, "SERVER");
  const jsons = fs.readdirSync(serverDir).filter(f => f.match(/^lesson_.*_runtime\.json$/));
  for (const f of jsons) {
    await upload(path.join(serverDir, f), `SERVER/${f}`);
  }

  // Upload ASSETS
  console.log("\n=== Lesson Assets ===");
  const assetsDir = path.join(repoRoot, "ASSETS");
  const lessons = fs.readdirSync(assetsDir).filter(d =>
    fs.statSync(path.join(assetsDir, d)).isDirectory()
  );

  for (const lesson of lessons.sort()) {
    const lessonDir = path.join(assetsDir, lesson);
    const files = fs.readdirSync(lessonDir).filter(f => {
      const ext = path.extname(f).toLowerCase();
      return [".png", ".jpg", ".jpeg", ".json"].includes(ext);
    });
    console.log(`\n  ${lesson}/ (${files.length} files)`);
    for (const f of files) {
      try {
        await upload(path.join(lessonDir, f), `ASSETS/${lesson}/${f}`);
      } catch (e) {
        console.error(`  ✗ ASSETS/${lesson}/${f}: ${e.message}`);
        errors++;
      }
    }
  }

  console.log(`\nDone: ${uploaded} uploaded, ${skipped} skipped (exist), ${errors} errors`);
}

main().catch(e => { console.error(e); process.exit(1); });
