import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getLesson } from "@/lib/lessons";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, status } = await requireAuth();
  if (error) return Response.json({ error }, { status });

  const { id } = await params;
  const lesson = await getLesson(id);
  if (!lesson) {
    return Response.json({ error: "Lesson not found" }, { status: 404 });
  }

  return Response.json({ lesson });
}
