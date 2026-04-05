import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { canEdit, canReview } from "@/lib/roles";
import { createAuditEvent } from "@/lib/audit";
import { Role } from "@prisma/client";

// GET /api/candidates?lessonId=1A&status=pending&mine=true
export async function GET(request: NextRequest) {
  const { error, status, session } = await requireAuth();
  if (error || !session) return Response.json({ error }, { status });

  const url = new URL(request.url);
  const lessonId = url.searchParams.get("lessonId");
  const filterStatus = url.searchParams.get("status");
  const mine = url.searchParams.get("mine");

  const where: Record<string, unknown> = {};
  if (lessonId) where.lessonId = lessonId;
  if (filterStatus) where.status = filterStatus;

  // Revisioners see only their own unless they are admin/owner
  if (mine === "true" || !canReview(session.activeRoleMode as Role)) {
    where.authorUserId = session.userId;
  }

  const candidates = await prisma.editCandidate.findMany({
    where,
    include: {
      author: {
        select: { id: true, displayName: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ candidates });
}

// POST /api/candidates
export async function POST(request: NextRequest) {
  const { error, status, session } = await requireAuth();
  if (error || !session) return Response.json({ error }, { status });

  if (!canEdit(session.activeRoleMode as Role)) {
    return Response.json({ error: "Only revisioner and above can create revisions" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { lessonId, sceneId, stepId, field, candidateType, originalValue, proposedValue, languageCode, sourceLanguage } = body;

  if (!lessonId || !field || !candidateType) {
    return Response.json(
      { error: "lessonId, field, and candidateType are required" },
      { status: 400 }
    );
  }

  if (!["text", "image", "poll", "overlay", "brief"].includes(candidateType)) {
    return Response.json({ error: "Invalid candidateType" }, { status: 400 });
  }

  if (typeof proposedValue !== "string" || proposedValue.trim() === "") {
    return Response.json({ error: "proposedValue is required and cannot be empty" }, { status: 400 });
  }

  const locationKey = [lessonId, sceneId, stepId, field].filter(Boolean).join(":");

  const candidate = await prisma.editCandidate.create({
    data: {
      lessonId,
      sceneId: sceneId || null,
      stepId: stepId || null,
      locationKey,
      field,
      candidateType,
      originalValue: originalValue || "",
      proposedValue,
      languageCode: languageCode || null,
      sourceLanguage: sourceLanguage || languageCode || null,
      status: "pending",
      authorUserId: session.userId,
    },
    include: {
      author: {
        select: { id: true, displayName: true, email: true },
      },
    },
  });

  await createAuditEvent(
    session.userId,
    "candidate.created",
    "EditCandidate",
    candidate.id,
    { lessonId, field, candidateType, locationKey }
  );

  return Response.json({ candidate }, { status: 201 });
}
