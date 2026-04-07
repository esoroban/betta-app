import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

export interface LessonSummary {
  lessonId: string;
  title: Record<string, string>;
  supportedLangs: string[];
  sceneCount: number;
  stepCount: number;
  thumbnailPath: string | null;
}

export interface LessonDetail {
  lesson_id: string;
  title: Record<string, string>;
  supported_langs: string[];
  scenes: Record<string, { scene_id: string; title: Record<string, string>; step_ids: string[] }>;
  steps: {
    step_id: string; scene_id: string; step_type: string; text_audience: string;
    prompt: Record<string, string>;
    options?: { id: string; text: Record<string, string> }[];
    correct_answer?: string;
    explanation?: Record<string, string>;
  }[];
  step_image_map?: Record<string, string>;
}

const LESSON_ORDER = [
  "1A","1B","2A","2B","3A","3B","4A","4B","5A","5B",
  "6A","6B","7A","7B","8A","8B","9A","9B","10A","10B",
  "11A","11B","12A","12B","13A",
];

// Production: persistent storage /app/storage/
// Dev: ../../ (up from betta-app root to SylaSlova repo)
// No fallback to data/ — single source of truth, no duplicates
function serverDir(): string {
  const storage = path.join(process.env.STORAGE_PATH || "/app/storage", "SERVER");
  if (fs.existsSync(storage)) return storage;
  return path.join(path.resolve(process.cwd(), "../.."), "SERVER");
}

function assetsDir(): string {
  const storage = path.join(process.env.STORAGE_PATH || "/app/storage", "ASSETS");
  if (fs.existsSync(storage)) return storage;
  return path.join(path.resolve(process.cwd(), "../.."), "ASSETS");
}

export async function listLessons(): Promise<LessonSummary[]> {
  const dir = serverDir();
  if (!fs.existsSync(dir)) return [];

  const lessons: LessonSummary[] = [];
  for (const id of LESSON_ORDER) {
    const file = path.join(dir, `lesson_${id}_runtime.json`);
    if (!fs.existsSync(file)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf-8"));
      const thumbFile = `${id.toLowerCase()}_thumbnail.png`;
      const hasThumb = fs.existsSync(path.join(assetsDir(), id, thumbFile));
      lessons.push({
        lessonId: id,
        title: data.title || {},
        supportedLangs: data.supported_langs || [],
        sceneCount: Object.keys(data.scenes || {}).length,
        stepCount: Array.isArray(data.steps) ? data.steps.length : 0,
        thumbnailPath: hasThumb ? `/api/assets/${id}/${thumbFile}` : null,
      });
    } catch { /* skip */ }
  }
  return lessons;
}

/**
 * Read baseline lesson JSON from disk (no DB overlay).
 */
export function getBaselineLesson(lessonId: string): LessonDetail | null {
  const file = path.join(serverDir(), `lesson_${lessonId}_runtime.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

/**
 * Published-first read model:
 * 1. If an active PublishVersion exists, return its materialized snapshot.lessonData.
 * 2. Otherwise, fall back to baseline JSON from disk.
 */
export async function getLesson(lessonId: string): Promise<LessonDetail | null> {
  const activeVersion = await prisma.publishVersion.findFirst({
    where: { lessonId, isActive: true },
    orderBy: { versionNumber: "desc" },
  });

  if (activeVersion?.snapshot) {
    const snapshot = activeVersion.snapshot as { lessonData?: LessonDetail };
    if (snapshot.lessonData) {
      return snapshot.lessonData;
    }
  }

  // Fallback: baseline from disk
  return getBaselineLesson(lessonId);
}

interface AppliedChange {
  id: string;
  field: string;
  candidateType: string;
  sceneId?: string | null;
  stepId?: string | null;
  proposedValue: string;
  sourceLanguage?: string | null;
  translatedValues?: Record<string, { lang: string; text: string; success: boolean }> | null;
}

/**
 * Apply accepted candidates to a lesson, producing a materialized snapshot.
 *
 * Supported candidateTypes:
 * - "text" (field: "teacher") → updates step.prompt / step.explanation with translated values
 * - "poll" (field: "poll") → updates step.prompt, options, explanation with translated values
 * - "image" (field: "image") → updates step_image_map entry
 * - "overlay" (field: "overlay") → stored as-is in appliedChanges (no direct lesson field yet)
 * - "brief" (field: "brief") → metadata only, no lesson data change
 */
export function applyChangesToLesson(
  baseline: LessonDetail,
  changes: AppliedChange[],
): LessonDetail {
  // Deep clone to avoid mutating the original
  const lesson: LessonDetail = JSON.parse(JSON.stringify(baseline));

  for (const change of changes) {
    if (change.candidateType === "text" && change.field === "teacher" && change.stepId) {
      applyTextChange(lesson, change);
    } else if (change.candidateType === "poll" && change.field === "poll" && change.stepId) {
      applyPollChange(lesson, change);
    } else if (change.candidateType === "image" && change.field === "image") {
      applyImageChange(lesson, change);
    }
    // overlay and brief: no direct lesson data mutation yet
  }

  return lesson;
}

function applyTextChange(lesson: LessonDetail, change: AppliedChange): void {
  const step = lesson.steps.find(s => s.step_id === change.stepId);
  if (!step) return;

  const translations = change.translatedValues;
  const sourceLang = change.sourceLanguage || "en";

  // Determine target: explanation for single_choice steps, prompt otherwise
  const target = (step.step_type === "single_choice" && step.explanation)
    ? step.explanation
    : step.prompt;

  // Apply source language directly
  target[sourceLang] = change.proposedValue;

  // Apply translations
  if (translations) {
    for (const [lang, val] of Object.entries(translations)) {
      if (lang === "_error") continue;
      if (val && typeof val === "object" && "text" in val && val.success) {
        target[lang] = val.text;
      }
    }
  }
}

function applyPollChange(lesson: LessonDetail, change: AppliedChange): void {
  const step = lesson.steps.find(s => s.step_id === change.stepId);
  if (!step) return;

  try {
    const pollData = JSON.parse(change.proposedValue);
    const translations = change.translatedValues;
    const sourceLang = change.sourceLanguage || "en";

    // Apply question
    if (pollData.question) {
      step.prompt[sourceLang] = pollData.question;
    }

    // Apply options
    if (pollData.options && step.options) {
      for (let i = 0; i < pollData.options.length && i < step.options.length; i++) {
        step.options[i].text[sourceLang] = pollData.options[i];
      }
    }

    // Apply explanation
    if (pollData.explanation && step.explanation) {
      step.explanation[sourceLang] = pollData.explanation;
    }

    // Apply correct answer
    if (pollData.correctAnswer) {
      step.correct_answer = pollData.correctAnswer;
    }

    // Apply translations for poll
    if (translations) {
      for (const [lang, val] of Object.entries(translations)) {
        if (lang === "_error" || !val || typeof val !== "object") continue;
        const tval = val as Record<string, unknown>;
        if (!tval.success) continue;

        if (tval.question && typeof tval.question === "string") {
          step.prompt[lang] = tval.question;
        }
        if (Array.isArray(tval.options) && step.options) {
          for (let i = 0; i < tval.options.length && i < step.options.length; i++) {
            step.options[i].text[lang] = tval.options[i] as string;
          }
        }
        if (tval.explanation && typeof tval.explanation === "string" && step.explanation) {
          step.explanation[lang] = tval.explanation;
        }
      }
    }
  } catch {
    // Malformed poll JSON — skip
  }
}

function applyImageChange(lesson: LessonDetail, change: AppliedChange): void {
  if (!change.stepId) return;

  if (!lesson.step_image_map) {
    lesson.step_image_map = {};
  }

  // proposedValue is the new image URL/path
  lesson.step_image_map[change.stepId] = change.proposedValue;
}
