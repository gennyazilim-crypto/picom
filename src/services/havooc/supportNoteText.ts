import { SUPPORT_NOTE_MAX_CHARS, SUPPORT_NOTE_MAX_WORDS } from "../../config/havoocLinks";

/** Shared client/server semantics: trim, collapse whitespace, strip C0 controls. */
export function normalizeSupportNoteBody(raw: string): string {
  return String(raw ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SUPPORT_NOTE_MAX_CHARS);
}

export function countSupportNoteWords(normalizedBody: string): number {
  const body = normalizedBody.trim();
  if (!body) return 0;
  return body.split(/\s+/).filter(Boolean).length;
}

const URL_HINT =
  /(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|gg|io|co|me|tv|xyz|app)(\/|\s|$)|javascript:\s*|data:\s*text\/html)/i;

export function supportNoteContainsUrl(normalizedBody: string): boolean {
  return URL_HINT.test(normalizedBody);
}

export type SupportNoteValidationCode =
  | "OK"
  | "NOTE_EMPTY"
  | "NOTE_WORD_LIMIT"
  | "NOTE_TOO_LONG"
  | "NOTE_LINKS_DENIED";

export function validateSupportNoteBody(raw: string): {
  ok: boolean;
  code: SupportNoteValidationCode;
  normalized: string;
  words: number;
  chars: number;
} {
  const normalized = normalizeSupportNoteBody(raw);
  const words = countSupportNoteWords(normalized);
  const chars = normalized.length;
  if (!normalized || words < 1) {
    return { ok: false, code: "NOTE_EMPTY", normalized, words, chars };
  }
  if (chars > SUPPORT_NOTE_MAX_CHARS) {
    return { ok: false, code: "NOTE_TOO_LONG", normalized, words, chars };
  }
  if (words > SUPPORT_NOTE_MAX_WORDS) {
    return { ok: false, code: "NOTE_WORD_LIMIT", normalized, words, chars };
  }
  if (supportNoteContainsUrl(normalized)) {
    return { ok: false, code: "NOTE_LINKS_DENIED", normalized, words, chars };
  }
  return { ok: true, code: "OK", normalized, words, chars };
}
