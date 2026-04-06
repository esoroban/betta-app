import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { canReview } from "@/lib/roles";
import { createAuditEvent } from "@/lib/audit";
import { translateToAllLangs, translatePollToAllLangs, translateOverlayToAllLangs } from "@/lib/translation";
import { Role, Prisma } from "@prisma/client";

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

// PATCH /api/candidates/:id — approve, reject, withdraw
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, status, session } = await requireAuth();
  if (error || !session) return Response.json({ error }, { status });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body?.action) {
    return Response.json({ error: "action is required (approve, reject, withdraw)" }, { status: 400 });
  }

  const candidate = await prisma.editCandidate.findUnique({ where: { id } });
  if (!candidate) {
    return Response.json({ error: "Candidate not found" }, { status: 404 });
  }

  const { action } = body;

  // ═══ APPROVE ═══
  if (action === "approve") {
    if (!canReview(session.activeRoleMode as Role)) {
      return Response.json({ error: "Only administrator/owner can approve" }, { status: 403 });
    }
    if (candidate.status !== "pending") {
      return Response.json({ error: `Cannot approve candidate with status '${candidate.status}'` }, { status: 409 });
    }

    // Translation fan-out for text/poll/overlay candidates with a source language
    let translatedValues: Record<string, unknown> | null = null;
    if (candidate.sourceLanguage && candidate.proposedValue) {
      try {
        if (candidate.candidateType === "text") {
          translatedValues = await translateToAllLangs(
            candidate.proposedValue,
            candidate.sourceLanguage
          ) as Record<string, unknown>;
        } else if (candidate.candidateType === "poll") {
          // Parse structured poll JSON and translate question, options, explanation
          const pollData = JSON.parse(candidate.proposedValue);
          translatedValues = await translatePollToAllLangs(
            { question: pollData.question, options: pollData.options || [], explanation: pollData.explanation },
            candidate.sourceLanguage
          ) as Record<string, unknown>;
        } else if (candidate.candidateType === "overlay") {
          // Parse overlay JSON, translate only the text field
          const overlayData = JSON.parse(candidate.proposedValue);
          translatedValues = await translateOverlayToAllLangs(
            overlayData.text || candidate.proposedValue,
            candidate.sourceLanguage
          ) as Record<string, unknown>;
        }
        // image candidates: no translation needed
      } catch (err) {
        // Translation failure is non-blocking; approve still proceeds
        translatedValues = {
          _error: `Translation failed: ${err instanceof Error ? err.message : "unknown"}`,
          [candidate.sourceLanguage]: {
            lang: candidate.sourceLanguage,
            text: candidate.proposedValue,
            success: true,
          },
        };
      }
    }

    const updated = await prisma.editCandidate.update({
      where: { id },
      data: {
        status: "accepted",
        reviewedBy: session.userId,
        reviewedAt: new Date(),
        reviewNote: body.note || null,
        ...(translatedValues ? { translatedValues: translatedValues as Prisma.InputJsonValue } : {}),
      },
      include: { author: { select: { id: true, displayName: true, email: true } } },
    });

    await createAuditEvent(session.userId, "candidate.approved", "EditCandidate", id, {
      lessonId: candidate.lessonId,
      field: candidate.field,
      sourceLanguage: candidate.sourceLanguage,
      translationSuccess: translatedValues ? !("_error" in translatedValues) : false,
      translatedLangs: translatedValues
        ? Object.keys(translatedValues).filter(k => k !== "_error")
        : [],
    });

    return Response.json({ candidate: updated, translatedValues });
  }

  // ═══ REJECT ═══
  if (action === "reject") {
    if (!canReview(session.activeRoleMode as Role)) {
      return Response.json({ error: "Only administrator/owner can reject" }, { status: 403 });
    }
    if (candidate.status !== "pending") {
      return Response.json({ error: `Cannot reject candidate with status '${candidate.status}'` }, { status: 409 });
    }
    if (!body.note) {
      return Response.json({ error: "note is required when rejecting" }, { status: 400 });
    }

    const updated = await prisma.editCandidate.update({
      where: { id },
      data: {
        status: "rejected",
        reviewedBy: session.userId,
        reviewedAt: new Date(),
        reviewNote: body.note,
      },
      include: { author: { select: { id: true, displayName: true, email: true } } },
    });

    await createAuditEvent(session.userId, "candidate.rejected", "EditCandidate", id, {
      lessonId: candidate.lessonId, field: candidate.field, note: body.note,
    });

    return Response.json({ candidate: updated });
  }

  // ═══ WITHDRAW ═══
  if (action === "withdraw") {
    if (candidate.authorUserId !== session.userId) {
      return Response.json({ error: "Only the author can withdraw their revision" }, { status: 403 });
    }
    if (candidate.status === "accepted") {
      return Response.json({ error: "Cannot withdraw an accepted revision" }, { status: 409 });
    }
    if (candidate.status === "withdrawn") {
      return Response.json({ error: "Already withdrawn" }, { status: 409 });
    }

    const updated = await prisma.editCandidate.update({
      where: { id },
      data: {
        status: "withdrawn",
        withdrawnAt: new Date(),
      },
      include: { author: { select: { id: true, displayName: true, email: true } } },
    });

    await createAuditEvent(session.userId, "candidate.withdrawn", "EditCandidate", id, {
      lessonId: candidate.lessonId, field: candidate.field,
    });

    return Response.json({ candidate: updated });
  }

  return Response.json({ error: "Invalid action. Use: approve, reject, withdraw" }, { status: 400 });
}
