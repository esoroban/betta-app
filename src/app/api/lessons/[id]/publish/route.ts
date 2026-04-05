import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { canReview } from "@/lib/roles";
import { createAuditEvent } from "@/lib/audit";
import { getLesson } from "@/lib/lessons";
import { Role, Prisma } from "@prisma/client";

/**
 * GET /api/lessons/:id/publish — list all published versions for a lesson
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, status, session } = await requireAuth();
  if (error || !session) return Response.json({ error }, { status });

  const { id } = await params;

  const versions = await prisma.publishVersion.findMany({
    where: { lessonId: id },
    orderBy: { versionNumber: "desc" },
    include: {
      candidates: {
        select: { id: true, field: true, candidateType: true, status: true },
      },
    },
  });

  return Response.json({ versions });
}

/**
 * POST /api/lessons/:id/publish — publish accepted candidates as a new version
 *
 * Body: { description?: string }
 *
 * This will:
 * 1. Collect all accepted (unpublished) candidates for this lesson
 * 2. Create a snapshot of current lesson state + applied changes
 * 3. Create a PublishVersion record
 * 4. Link candidates to the version
 * 5. Mark the new version as active (deactivate previous)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, status, session } = await requireAuth();
  if (error || !session) return Response.json({ error }, { status });

  if (!canReview(session.activeRoleMode as Role)) {
    return Response.json({ error: "Only administrator/owner can publish" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  // Get current lesson data as base snapshot
  const currentLesson = await getLesson(id);
  if (!currentLesson) {
    return Response.json({ error: "Lesson not found" }, { status: 404 });
  }

  // Find all accepted candidates for this lesson that haven't been published yet
  const unpublishedCandidates = await prisma.editCandidate.findMany({
    where: {
      lessonId: id,
      status: "accepted",
      publishVersionId: null,
    },
    include: {
      author: { select: { id: true, displayName: true } },
    },
  });

  if (unpublishedCandidates.length === 0) {
    return Response.json(
      { error: "No accepted unpublished candidates to publish" },
      { status: 400 }
    );
  }

  // Build snapshot: current lesson data + list of applied changes
  const snapshot = {
    lessonData: currentLesson,
    appliedChanges: unpublishedCandidates.map(c => ({
      id: c.id,
      field: c.field,
      candidateType: c.candidateType,
      sceneId: c.sceneId,
      stepId: c.stepId,
      originalValue: c.originalValue,
      proposedValue: c.proposedValue,
      sourceLanguage: c.sourceLanguage,
      translatedValues: c.translatedValues,
      authorId: c.authorUserId,
      authorName: c.author.displayName,
    })),
    publishedAt: new Date().toISOString(),
  };

  // Get next version number
  const lastVersion = await prisma.publishVersion.findFirst({
    where: { lessonId: id },
    orderBy: { versionNumber: "desc" },
  });
  const nextVersionNumber = (lastVersion?.versionNumber || 0) + 1;

  // Transaction: create version, link candidates, deactivate old versions
  const version = await prisma.$transaction(async (tx) => {
    // Deactivate all previous versions for this lesson
    await tx.publishVersion.updateMany({
      where: { lessonId: id, isActive: true },
      data: { isActive: false },
    });

    // Create new version
    const newVersion = await tx.publishVersion.create({
      data: {
        lessonId: id,
        versionNumber: nextVersionNumber,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        description: body.description || `Version ${nextVersionNumber}: ${unpublishedCandidates.length} changes`,
        isActive: true,
        publishedBy: session.userId,
      },
    });

    // Link candidates to this version
    await tx.editCandidate.updateMany({
      where: {
        id: { in: unpublishedCandidates.map(c => c.id) },
      },
      data: {
        publishVersionId: newVersion.id,
      },
    });

    return newVersion;
  });

  await createAuditEvent(
    session.userId,
    "version.published",
    "PublishVersion",
    version.id,
    {
      lessonId: id,
      versionNumber: nextVersionNumber,
      candidateCount: unpublishedCandidates.length,
      candidateIds: unpublishedCandidates.map(c => c.id),
    }
  );

  return Response.json({
    version: {
      ...version,
      candidateCount: unpublishedCandidates.length,
    },
  }, { status: 201 });
}

/**
 * PATCH /api/lessons/:id/publish — rollback to a specific version
 *
 * Body: { action: "rollback", versionId: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, status, session } = await requireAuth();
  if (error || !session) return Response.json({ error }, { status });

  if (!canReview(session.activeRoleMode as Role)) {
    return Response.json({ error: "Only administrator/owner can rollback" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (!body?.action || body.action !== "rollback" || !body.versionId) {
    return Response.json({ error: "action: 'rollback' and versionId are required" }, { status: 400 });
  }

  const targetVersion = await prisma.publishVersion.findUnique({
    where: { id: body.versionId },
  });

  if (!targetVersion || targetVersion.lessonId !== id) {
    return Response.json({ error: "Version not found for this lesson" }, { status: 404 });
  }

  if (targetVersion.isActive) {
    return Response.json({ error: "This version is already active" }, { status: 409 });
  }

  // Transaction: deactivate current, activate target
  await prisma.$transaction(async (tx) => {
    await tx.publishVersion.updateMany({
      where: { lessonId: id, isActive: true },
      data: { isActive: false },
    });

    await tx.publishVersion.update({
      where: { id: body.versionId },
      data: { isActive: true },
    });
  });

  await createAuditEvent(
    session.userId,
    "version.rollback",
    "PublishVersion",
    body.versionId,
    {
      lessonId: id,
      rolledBackToVersion: targetVersion.versionNumber,
    }
  );

  return Response.json({
    message: `Rolled back to version ${targetVersion.versionNumber}`,
    version: { ...targetVersion, isActive: true },
  });
}
