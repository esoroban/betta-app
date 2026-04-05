import { revokeSession } from "@/lib/auth";

export async function POST() {
  await revokeSession();
  return Response.json({ ok: true });
}
