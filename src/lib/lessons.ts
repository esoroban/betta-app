import fs from "fs";
import path from "path";

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

// Docker: /app/data/  Dev: ../../ (up from betta-app root to SylaSlova repo)
function dataRoot(): string {
  const dockerPath = path.join(process.cwd(), "data", "SERVER");
  if (fs.existsSync(dockerPath)) return path.join(process.cwd(), "data");
  return path.resolve(process.cwd(), "../..");
}

function serverDir(): string { return path.join(dataRoot(), "SERVER"); }
function assetsDir(): string { return path.join(dataRoot(), "ASSETS"); }

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

export async function getLesson(lessonId: string): Promise<LessonDetail | null> {
  const file = path.join(serverDir(), `lesson_${lessonId}_runtime.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}
