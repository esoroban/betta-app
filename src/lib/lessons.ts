import fs from "fs";
import path from "path";
import { getJsonFile, getPublicUrl, isRemoteStorage } from "./storage";

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

function getLocalServerDir(): string {
  return path.join(path.resolve(process.cwd(), "../.."), "SERVER");
}

function getLocalAssetsDir(): string {
  return path.join(path.resolve(process.cwd(), "../.."), "ASSETS");
}

export async function listLessons(): Promise<LessonSummary[]> {
  const lessons: LessonSummary[] = [];

  for (const id of LESSON_ORDER) {
    try {
      let data: LessonDetail | null = null;

      if (isRemoteStorage()) {
        data = await getJsonFile<LessonDetail>(`SERVER/lesson_${id}_runtime.json`);
      } else {
        const filePath = path.join(getLocalServerDir(), `lesson_${id}_runtime.json`);
        if (fs.existsSync(filePath)) {
          data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        }
      }

      if (!data) continue;

      const thumbFile = `${id.toLowerCase()}_thumbnail.png`;
      let thumbnailPath: string | null = null;

      if (isRemoteStorage()) {
        thumbnailPath = getPublicUrl(`ASSETS/${id}/${thumbFile}`);
      } else {
        const thumbFullPath = path.join(getLocalAssetsDir(), id, thumbFile);
        if (fs.existsSync(thumbFullPath)) {
          thumbnailPath = `/api/assets/${id}/${thumbFile}`;
        }
      }

      lessons.push({
        lessonId: id,
        title: data.title || {},
        supportedLangs: data.supported_langs || [],
        sceneCount: Object.keys(data.scenes || {}).length,
        stepCount: Array.isArray(data.steps) ? data.steps.length : 0,
        thumbnailPath,
      });
    } catch {
      // skip
    }
  }

  return lessons;
}

export async function getLesson(lessonId: string): Promise<LessonDetail | null> {
  if (isRemoteStorage()) {
    return getJsonFile<LessonDetail>(`SERVER/lesson_${lessonId}_runtime.json`);
  }

  const file = path.join(getLocalServerDir(), `lesson_${lessonId}_runtime.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

export function resolveStepImage(
  lessonId: string,
  sceneId: string,
  stepId: string,
  stepImageMap?: Record<string, string>
): string {
  if (stepImageMap?.[stepId]) {
    const mapped = stepImageMap[stepId];
    const match = mapped.match(/ASSETS\/(.+)/);
    if (match) {
      if (isRemoteStorage()) return getPublicUrl(`ASSETS/${match[1]}`);
      return `/api/assets/${match[1]}`;
    }
  }
  const bgFile = `${lessonId.toLowerCase()}_${sceneId}_bg.png`;
  if (isRemoteStorage()) return getPublicUrl(`ASSETS/${lessonId}/${bgFile}`);
  return `/api/assets/${lessonId}/${bgFile}`;
}
