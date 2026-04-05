import { getStorageInfo } from "@/lib/storage";

export async function GET() {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    storage: getStorageInfo(),
  });
}
