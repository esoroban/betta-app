/**
 * Image generation service.
 *
 * Flow:
 * 1. Revisioner enters a prompt in any language
 * 2. Prompt is translated to English via translation service
 * 3. English prompt goes through consistency/improvement step
 * 4. Improved prompt is sent to Gemini Imagen API
 * 5. Generated image is returned as Buffer
 *
 * Requires GEMINI_API_KEY env var.
 */

import { translateToAllLangs } from "./translation";

export interface ImageGenerationResult {
  imageBuffer: Buffer;
  mimeType: string;
  originalPrompt: string;
  englishPrompt: string;
  improvedPrompt: string;
}

/**
 * Translate a prompt from any language to English.
 */
async function translatePromptToEnglish(prompt: string, sourceLang: string): Promise<string> {
  if (sourceLang === "en") return prompt;
  const results = await translateToAllLangs(prompt, sourceLang, ["en"]);
  if (results.en?.success) return results.en.text;
  throw new Error(`Failed to translate prompt to English: ${results.en?.error || "unknown"}`);
}

/**
 * Improve/refine an English prompt for better image generation.
 * Uses Gemini text API for consistency and quality improvement.
 */
async function improvePrompt(englishPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Without API key, return the prompt as-is with basic improvements
    return `High quality children's educational illustration. ${englishPrompt}. Colorful, friendly, age-appropriate for 5-8 year olds. Clean background, professional digital art style.`;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are an image prompt engineer for a children's educational app (ages 5-8).
Improve this image generation prompt for high quality results. Keep it under 200 words.
The image should be: colorful, friendly, age-appropriate, clean background, professional digital art.
Do NOT include any text or letters in the image.

Original prompt: "${englishPrompt}"

Return ONLY the improved prompt, nothing else.`
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 300,
        }
      }),
    });

    if (!res.ok) {
      console.error("Gemini prompt improvement failed:", res.status);
      return `High quality children's educational illustration. ${englishPrompt}. Colorful, friendly, age-appropriate for 5-8 year olds.`;
    }

    const data = await res.json();
    const improved = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return improved || `High quality children's educational illustration. ${englishPrompt}. Colorful, friendly, age-appropriate for 5-8 year olds.`;
  } catch (err) {
    console.error("Prompt improvement error:", err);
    return `High quality children's educational illustration. ${englishPrompt}. Colorful, friendly, age-appropriate for 5-8 year olds.`;
  }
}

/**
 * Generate an image using Gemini Imagen API.
 */
async function generateWithGemini(prompt: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Image generation requires a Gemini API key.");
  }

  // Use Imagen 3 via Gemini API
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "16:9",
        safetyFilterLevel: "block_few",
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini Imagen API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  const prediction = data?.predictions?.[0];
  if (!prediction?.bytesBase64Encoded) {
    throw new Error("No image data in Gemini response");
  }

  return {
    buffer: Buffer.from(prediction.bytesBase64Encoded, "base64"),
    mimeType: prediction.mimeType || "image/png",
  };
}

/**
 * Full image generation pipeline:
 * 1. Translate prompt to English
 * 2. Improve prompt
 * 3. Generate image
 */
export async function generateImage(
  prompt: string,
  sourceLang: string
): Promise<ImageGenerationResult> {
  // Step 1: Translate to English
  const englishPrompt = await translatePromptToEnglish(prompt, sourceLang);

  // Step 2: Improve prompt
  const improvedPrompt = await improvePrompt(englishPrompt);

  // Step 3: Generate image
  const { buffer, mimeType } = await generateWithGemini(improvedPrompt);

  return {
    imageBuffer: buffer,
    mimeType,
    originalPrompt: prompt,
    englishPrompt,
    improvedPrompt,
  };
}

/**
 * Check if image generation is available (API key configured).
 */
export function isImageGenerationAvailable(): boolean {
  return !!process.env.GEMINI_API_KEY;
}
