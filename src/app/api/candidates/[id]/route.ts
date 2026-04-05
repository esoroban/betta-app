import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/candidates/:id
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, status, session } = await requireAuth();
  if (error || !session) return Response.json({ error }, { status });

  const { id } = await params;

  const candidate = await prisma.editCandidate.findUnique({
    where: { id },
    include: {
      author: {
        select: { id: true, displayName: true, email: true },
      },
    },
  });

  if (!candidate) {
    return Response.json({ error: "Candidate not found" }, { status: 404 });
  }

  return Response.json({ candidate });
}
