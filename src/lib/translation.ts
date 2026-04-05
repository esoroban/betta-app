/**
 * Translation service using Google Translate free API.
 *
 * Translates text between supported languages (en, ru, uk).
 * Used after approve to fan-out source-of-truth text to all supported langs.
 */

const SUPPORTED_LANGS = ["en", "ru", "uk"];

interface TranslationResult {
  lang: string;
  text: string;
  success: boolean;
  error?: string;
}

/**
 * Translate text from source language to target language using Google Translate.
 * Uses the free translate.googleapis.com endpoint.
 */
async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  if (sourceLang === targetLang) return text;
  if (!text.trim()) return text;

  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", sourceLang);
  url.searchParams.set("tl", targetLang);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) {
    throw new Error(`Google Translate returned ${res.status}`);
  }

  const data = await res.json();
  // Response format: [[["translated text","original text",null,null,N]],null,"en"]
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error("Unexpected response format from Google Translate");
  }

  // Concatenate all translated segments
  const translated = data[0]
    .filter((segment: unknown[]) => Array.isArray(segment) && segment[0])
    .map((segment: unknown[]) => segment[0])
    .join("");

  return translated;
}

/**
 * Fan-out: translate sourceText from sourceLang to all other supported languages.
 * Returns a map of { lang: translatedText } for all languages including source.
 */
export async function translateToAllLangs(
  sourceText: string,
  sourceLang: string,
  targetLangs?: string[]
): Promise<Record<string, TranslationResult>> {
  const langs = targetLangs || SUPPORTED_LANGS;
  const results: Record<string, TranslationResult> = {};

  // Source language gets the original text
  results[sourceLang] = { lang: sourceLang, text: sourceText, success: true };

  // Translate to each other language in parallel
  const otherLangs = langs.filter(l => l !== sourceLang);
  const translations = await Promise.allSettled(
    otherLangs.map(async (lang) => {
      const text = await translateText(sourceText, sourceLang, lang);
      return { lang, text };
    })
  );

  for (const result of translations) {
    if (result.status === "fulfilled") {
      results[result.value.lang] = {
        lang: result.value.lang,
        text: result.value.text,
        success: true,
      };
    } else {
      const lang = otherLangs[translations.indexOf(result)];
      results[lang] = {
        lang,
        text: "",
        success: false,
        error: result.reason?.message || "Translation failed",
      };
    }
  }

  return results;
}

/**
 * Get the list of supported languages.
 */
export function getSupportedLangs(): string[] {
  return [...SUPPORTED_LANGS];
}

/**
 * Check if a language code is supported.
 */
export function isLangSupported(lang: string): boolean {
  return SUPPORTED_LANGS.includes(lang);
}
