import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

function assetsDir(): string {
  const dockerPath = path.join(process.cwd(), "data", "ASSETS");
  if (fs.existsSync(dockerPath)) return dockerPath;
  return path.join(path.resolve(process.cwd(), "../.."), "ASSETS");
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const base = assetsDir();
  const filePath = path.join(base, ...segments);

  if (!filePath.startsWith(base)) return new Response("Forbidden", { status: 403 });
  if (!fs.existsSync(filePath)) return new Response("Not found", { status: 404 });

  const ext = path.extname(filePath).toLowerCase();
  const mime: Record<string, string> = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".svg": "image/svg+xml",
  };
  const buffer = fs.readFileSync(filePath);
  return new Response(buffer as unknown as BodyInit, {
    headers: { "Content-Type": mime[ext] || "application/octet-stream", "Cache-Control": "public, max-age=3600" },
  });
}
