import { requireAuth } from "@/lib/auth";
import { listLessons } from "@/lib/lessons";

export async function GET() {
  const { error, status } = await requireAuth();
  if (error) return Response.json({ error }, { status });

  const lessons = await listLessons();
  return Response.json({ lessons });
}
