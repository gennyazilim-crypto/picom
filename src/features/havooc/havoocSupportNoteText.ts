import { SUPPORT_NOTE_MAX_CHARS, SUPPORT_NOTE_MAX_WORDS } from "./havoocConfig";

/**
 * Shared Support Note text semantics (must match SQL validate_support_note_body).
 * Whitespace is collapsed; empty after trim is rejected; max 20 words / 160 chars.
 */
export function normalizeSupportNoteBody(raw: string): string {
  return raw.replace(/\s+/gu, " ").trim();
}

export function countSupportNoteWords(normalized: string): number {
  if (!normalized) return 0;
  return normalized.split(" ").filter(Boolean).length;
}

const HTML_PATTERN = /<\s*\/?\s*[a-z]/iu;
const URL_PATTERN =
  /(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|net|org|gg|io|co|xyz|info|biz|me|tv)(?:\/|\s|$))/iu;

export type SupportNoteValidation =
  | Readonly<{ ok: true; body: string; wordCount: number; charCount: number }>
  | Readonly<{ ok: false; code: SupportNoteValidationCode; wordCount: number; charCount: number }>;

export type SupportNoteValidationCode =
  | "empty"
  | "too_long_words"
  | "too_long_chars"
  | "html_forbidden"
  | "url_forbidden";

export function validateSupportNoteBody(raw: string): SupportNoteValidation {
  const body = normalizeSupportNoteBody(raw);
  const wordCount = countSupportNoteWords(body);
  const charCount = body.length;

  if (!body) return { ok: false, code: "empty", wordCount: 0, charCount: 0 };
  if (charCount > SUPPORT_NOTE_MAX_CHARS) {
    return { ok: false, code: "too_long_chars", wordCount, charCount };
  }
  if (wordCount > SUPPORT_NOTE_MAX_WORDS) {
    return { ok: false, code: "too_long_words", wordCount, charCount };
  }
  if (HTML_PATTERN.test(body)) {
    return { ok: false, code: "html_forbidden", wordCount, charCount };
  }
  if (URL_PATTERN.test(body)) {
    return { ok: false, code: "url_forbidden", wordCount, charCount };
  }
  return { ok: true, body, wordCount, charCount };
}

export function supportNoteDraftMetrics(raw: string): Readonly<{ wordCount: number; charCount: number }> {
  const body = normalizeSupportNoteBody(raw);
  return { wordCount: countSupportNoteWords(body), charCount: body.length };
}
