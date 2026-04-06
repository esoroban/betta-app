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
 * Translate structured poll data: question, options[], explanation.
 * Returns a map of { lang: { question, options, explanation } } for all languages.
 */
export async function translatePollToAllLangs(
  pollData: { question: string; options: string[]; explanation?: string },
  sourceLang: string
): Promise<Record<string, { question: TranslationResult; options: TranslationResult[]; explanation?: TranslationResult }>> {
  const langs = SUPPORTED_LANGS;
  const results: Record<string, { question: TranslationResult; options: TranslationResult[]; explanation?: TranslationResult }> = {};

  // Source language gets original
  results[sourceLang] = {
    question: { lang: sourceLang, text: pollData.question, success: true },
    options: pollData.options.map(o => ({ lang: sourceLang, text: o, success: true })),
    ...(pollData.explanation ? { explanation: { lang: sourceLang, text: pollData.explanation, success: true } } : {}),
  };

  const otherLangs = langs.filter(l => l !== sourceLang);
  for (const lang of otherLangs) {
    try {
      const q = await translateText(pollData.question, sourceLang, lang);
      const opts = await Promise.all(
        pollData.options.map(async o => {
          const t = await translateText(o, sourceLang, lang);
          return { lang, text: t, success: true } as TranslationResult;
        })
      );
      let expl: TranslationResult | undefined;
      if (pollData.explanation) {
        const e = await translateText(pollData.explanation, sourceLang, lang);
        expl = { lang, text: e, success: true };
      }
      results[lang] = { question: { lang, text: q, success: true }, options: opts, ...(expl ? { explanation: expl } : {}) };
    } catch (err) {
      results[lang] = {
        question: { lang, text: "", success: false, error: String(err) },
        options: pollData.options.map(() => ({ lang, text: "", success: false, error: String(err) })),
      };
    }
  }

  return results;
}

/**
 * Translate overlay text to all supported languages.
 * Only the text field is translated; style params stay the same.
 */
export async function translateOverlayToAllLangs(
  overlayText: string,
  sourceLang: string
): Promise<Record<string, TranslationResult>> {
  return translateToAllLangs(overlayText, sourceLang);
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
