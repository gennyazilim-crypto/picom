// Run with: npm run havooc:support-notes:smoke
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SUPPORT_NOTE_MAX_WORDS = 20;
const SUPPORT_NOTE_MAX_CHARS = 160;

function normalizeSupportNoteBody(raw) {
  return raw.replace(/\s+/gu, " ").trim();
}
function countSupportNoteWords(normalized) {
  if (!normalized) return 0;
  return normalized.split(" ").filter(Boolean).length;
}
const HTML_PATTERN = /<\s*\/?\s*[a-z]/iu;
const URL_PATTERN =
  /(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|net|org|gg|io|co|xyz|info|biz|me|tv)(?:\/|\s|$))/iu;
function validateSupportNoteBody(raw) {
  const body = normalizeSupportNoteBody(raw);
  const wordCount = countSupportNoteWords(body);
  const charCount = body.length;
  if (!body) return { ok: false, code: "empty", wordCount: 0, charCount: 0 };
  if (charCount > SUPPORT_NOTE_MAX_CHARS) return { ok: false, code: "too_long_chars", wordCount, charCount };
  if (wordCount > SUPPORT_NOTE_MAX_WORDS) return { ok: false, code: "too_long_words", wordCount, charCount };
  if (HTML_PATTERN.test(body)) return { ok: false, code: "html_forbidden", wordCount, charCount };
  if (URL_PATTERN.test(body)) return { ok: false, code: "url_forbidden", wordCount, charCount };
  return { ok: true, body, wordCount, charCount };
}

// Keep smoke validator aligned with source module.
const sourceText = readFileSync("src/features/havooc/havoocSupportNoteText.ts", "utf8");
assert.ok(sourceText.includes("SUPPORT_NOTE_MAX_WORDS"));
assert.ok(sourceText.includes("html_forbidden"));
assert.ok(sourceText.includes("url_forbidden"));

const configSource = readFileSync("src/features/havooc/havoocConfig.ts", "utf8");
assert.ok(configSource.includes('HAVOOC_PROJECT_KEY = "havooc"'));
assert.ok(configSource.includes("HAVOOC_LINKS"));
assert.ok(configSource.includes("donate:"));

assert.equal(normalizeSupportNoteBody("  hello   world  "), "hello world");
assert.equal(countSupportNoteWords("hello world"), 2);

const ok = validateSupportNoteBody("Supporting HAVOOC from day one.");
assert.equal(ok.ok, true);
assert.equal(ok.wordCount, 5);

const twentyOne = Array.from({ length: 21 }, (_, i) => `w${i}`).join(" ");
const tooLongWords = validateSupportNoteBody(twentyOne);
assert.equal(tooLongWords.ok, false);
assert.equal(tooLongWords.code, "too_long_words");

const empty = validateSupportNoteBody("   \n\t  ");
assert.equal(empty.ok, false);
assert.equal(empty.code, "empty");

const tooLongChars = validateSupportNoteBody("x".repeat(161));
assert.equal(tooLongChars.ok, false);
assert.equal(tooLongChars.code, "too_long_chars");

const html = validateSupportNoteBody("Hello <script>alert(1)</script>");
assert.equal(html.ok, false);
assert.equal(html.code, "html_forbidden");

const url = validateSupportNoteBody("Check https://spam.example.com now");
assert.equal(url.ok, false);
assert.equal(url.code, "url_forbidden");

const twenty = Array.from({ length: 20 }, (_, i) => `word${i}`).join(" ");
const twentyOk = validateSupportNoteBody(twenty);
assert.equal(twentyOk.ok, true);
assert.equal(twentyOk.wordCount, 20);

const additiveMigration = "supabase/migrations/20260808230000_support_notes_html_guard_and_list_authors.sql";
assert.ok(existsSync(additiveMigration), "additive migration missing");
const additiveSql = readFileSync(additiveMigration, "utf8");
for (const marker of [
  "upsert_project_support_note",
  "list_project_support_notes",
  "NOTE_HTML_DENIED",
  "author_display_name",
  "support_note_contains_html",
]) {
  assert.ok(additiveSql.includes(marker), `additive migration missing marker: ${marker}`);
}

const locales = ["en", "tr", "de", "fr", "es", "it", "pt", "nl", "pl", "ru"];
const en = JSON.parse(readFileSync("src/i18n/locales/en/havooc.json", "utf8"));
for (const locale of locales) {
  const file = path.join("src/i18n/locales", locale, "havooc.json");
  assert.ok(existsSync(file), `missing ${file}`);
  const catalog = JSON.parse(readFileSync(file, "utf8"));
  assert.deepEqual(Object.keys(catalog).sort(), Object.keys(en).sort(), `key parity failed for ${locale}`);
}

const schemaModule = await import(pathToFileURL(path.resolve("src/services/analytics/eventSchema.ts")).href);
const envelope = schemaModule.buildEnvelope("havooc_support_note_create", {
  projectKey: "havooc",
  body: "should never appear",
  message: "also blocked",
});
assert.ok(envelope);
assert.equal(envelope.metadata.projectKey, "havooc");
assert.equal(envelope.metadata.body, undefined);
assert.equal(envelope.metadata.message, undefined);

const pageA = [{ id: "1" }, { id: "2" }];
const pageB = [{ id: "2" }, { id: "3" }];
const seen = new Set(pageA.map((n) => n.id));
const merged = [...pageA];
for (const note of pageB) {
  if (!seen.has(note.id)) merged.push(note);
}
assert.deepEqual(merged.map((n) => n.id), ["1", "2", "3"]);

// UI/service wiring markers
const service = readFileSync("src/features/havooc/havoocSupportNotesService.ts", "utf8");
assert.ok(service.includes("havooc_support_note_create"));
assert.ok(!service.includes("metadata.body"));
assert.ok(service.includes("upsert_project_support_note"));
const hub = readFileSync("src/features/havooc/HavoocSupportHub.tsx", "utf8");
assert.ok(hub.includes("SupportNotesSection"));
const app = readFileSync("src/App.tsx", "utf8");
assert.ok(app.includes('activeView === "havooc"'));

console.log("havooc-support-notes-smoke: PASS");
