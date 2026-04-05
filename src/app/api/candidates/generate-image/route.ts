import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { canEdit } from "@/lib/roles";
import { generateImage, isImageGenerationAvailable } from "@/lib/image-generation";
import { saveCandidateImage } from "@/lib/storage";
import { createAuditEvent } from "@/lib/audit";
import { Role } from "@prisma/client";
import { randomUUID } from "crypto";

/**
 * POST /api/candidates/generate-image
 *
 * Body: { prompt: string, sourceLang: string, lessonId: string, sceneId?: string, stepId?: string }
 *
 * Flow:
 * 1. Translate prompt to English
 * 2. Improve prompt via Gemini
 * 3. Generate image via Gemini Imagen
 * 4. Save to storage
 * 5. Return preview URL + metadata
 */
export async function POST(request: NextRequest) {
  const { error, status, session } = await requireAuth();
  if (error || !session) return Response.json({ error }, { status });

  if (!canEdit(session.activeRoleMode as Role)) {
    return Response.json({ error: "Only revisioner and above can generate images" }, { status: 403 });
  }

  if (!isImageGenerationAvailable()) {
    return Response.json(
      { error: "Image generation is not configured. GEMINI_API_KEY is required." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body?.prompt || !body?.lessonId) {
    return Response.json({ error: "prompt and lessonId are required" }, { status: 400 });
  }

  const { prompt, sourceLang, lessonId, sceneId, stepId } = body;

  try {
    const result = await generateImage(prompt, sourceLang || "en");

    // Save generated image to storage with a temp ID
    const tempId = `gen_${randomUUID()}`;
    const filename = saveCandidateImage(tempId, result.imageBuffer, ".png");

    await createAuditEvent(
      session.userId,
      "image.generated",
      "EditCandidate",
      tempId,
      {
        lessonId,
        sceneId,
        stepId,
        originalPrompt: result.originalPrompt,
        englishPrompt: result.englishPrompt,
        improvedPrompt: result.improvedPrompt,
      }
    );

    return Response.json({
      tempId,
      filename,
      previewUrl: `/api/candidates/generate-image?file=${filename}`,
      originalPrompt: result.originalPrompt,
      englishPrompt: result.englishPrompt,
      improvedPrompt: result.improvedPrompt,
      mimeType: result.mimeType,
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/candidates/generate-image?file=<filename>
 * Serve a generated candidate image from storage.
 */
export async function GET(request: NextRequest) {
  const { error, status } = await requireAuth();
  if (error) return Response.json({ error }, { status });

  const url = new URL(request.url);
  const file = url.searchParams.get("file");
  if (!file) {
    return Response.json({ error: "file parameter required" }, { status: 400 });
  }

  // Sanitize filename to prevent directory traversal
  const safeName = file.replace(/[^a-zA-Z0-9._-]/g, "");
  const { getCandidateImagePath } = await import("@/lib/storage");
  const filePath = getCandidateImagePath(safeName);

  if (!filePath) {
    return Response.json({ error: "Image not found" }, { status: 404 });
  }

  const fs = await import("fs");
  const buffer = fs.readFileSync(filePath);
  const ext = safeName.split(".").pop()?.toLowerCase();
  const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";

  return new Response(buffer, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
