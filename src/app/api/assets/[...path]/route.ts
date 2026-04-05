import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { getFile, isRemoteStorage, getPublicUrl } from "@/lib/storage";

const ASSETS_DIR = path.join(path.resolve(process.cwd(), "../.."), "ASSETS");

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const assetKey = `ASSETS/${segments.join("/")}`;

  // If remote storage with public URL — redirect to CDN
  if (isRemoteStorage() && process.env.S3_PUBLIC_URL) {
    return Response.redirect(getPublicUrl(assetKey), 302);
  }

  // Remote storage without public URL — proxy through API
  if (isRemoteStorage()) {
    const buffer = await getFile(assetKey);
    if (!buffer) return new Response("Not found", { status: 404 });

    const ext = path.extname(segments[segments.length - 1]).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
      ".webp": "image/webp", ".svg": "image/svg+xml",
    };
    return new Response(buffer as unknown as BodyInit, {
      headers: { "Content-Type": mimeTypes[ext] || "application/octet-stream", "Cache-Control": "public, max-age=3600" },
    });
  }

  // Local filesystem (dev)
  const filePath = path.join(ASSETS_DIR, ...segments);
  if (!filePath.startsWith(ASSETS_DIR)) return new Response("Forbidden", { status: 403 });
  if (!fs.existsSync(filePath)) return new Response("Not found", { status: 404 });

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".svg": "image/svg+xml",
  };
  const buffer = fs.readFileSync(filePath);
  return new Response(buffer, {
    headers: { "Content-Type": mimeTypes[ext] || "application/octet-stream", "Cache-Control": "public, max-age=3600" },
  });
}
