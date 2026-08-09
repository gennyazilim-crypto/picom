/**
 * Static smoke for HAVOOC Support Hub + Support Notes.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

const migration = "supabase/migrations/20260808220000_project_support_notes.sql";
assert.ok(existsSync(path.join(root, migration)), `missing ${migration}`);
const sql = read(migration);

for (const table of [
  "support_projects",
  "project_support_notes",
  "project_support_note_reports",
  "project_support_note_rate_limits",
]) {
  assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
}

for (const rpc of [
  "upsert_project_support_note",
  "delete_project_support_note",
  "list_project_support_notes",
  "get_my_project_support_note",
  "report_project_support_note",
  "moderate_project_support_note",
  "get_support_project",
  "support_note_word_count",
  "support_note_normalize_body",
]) {
  assert.match(sql, new RegExp(`function public\\.${rpc}\\b`), `missing ${rpc}`);
}

assert.match(sql, /project_support_notes_one_active_idx/);
assert.match(sql, /NOTE_WORD_LIMIT/);
assert.match(sql, /NOTE_TOO_LONG/);
assert.match(sql, /NOTE_LINKS_DENIED/);
assert.match(sql, /NOTE_EMPTY/);
assert.match(sql, /RATE_LIMITED/);
assert.match(sql, /words > 20/);
assert.match(sql, /char_length\(normalized\) > 160/);
assert.doesNotMatch(sql, /for insert to authenticated/);
assert.doesNotMatch(sql, /for update to authenticated/);
assert.doesNotMatch(sql, /USING\s*\(\s*true\s*\)/i);
assert.match(sql, /dashboard\.read must NOT grant/);

const flags = read("src/services/featureFlagService.ts");
assert.match(flags, /enableHavoocSupportHub/);
assert.match(flags, /enableHavoocSupportHub:\s*appConfig\.environment !== "production"/);

const clientConfig = read("supabase/functions/client-config/index.ts");
assert.match(clientConfig, /PICOM_ENABLE_HAVOOC_SUPPORT_HUB/);

const service = read("src/services/havooc/projectSupportNotesService.ts");
assert.match(service, /upsert_project_support_note/);
assert.match(service, /havooc_support_note_create/);
assert.doesNotMatch(service, /localStorage\.(setItem|getItem)/);
assert.match(service, /enqueue\(name, \{ project:/);
assert.doesNotMatch(service, /enqueue\([^)]*body/);

const textUtil = read("src/services/havooc/supportNoteText.ts");
assert.match(textUtil, /SUPPORT_NOTE_MAX_WORDS/);
assert.match(textUtil, /NOTE_WORD_LIMIT/);
assert.match(textUtil, /NOTE_LINKS_DENIED/);

const ui = read("src/components/havooc/HavoocSupportHubWorkspace.tsx");
assert.doesNotMatch(ui, /dangerouslySetInnerHTML/);
assert.match(ui, /notes\.title/);
assert.match(ui, /HAVOOC_LINKS/);
assert.doesNotMatch(ui, /Can't wait to fight alongside/);

const links = read("src/config/havoocLinks.ts");
assert.match(links, /HAVOOC_LINKS/);
assert.match(links, /SUPPORT_NOTE_MAX_WORDS = 20/);
assert.match(links, /SUPPORT_NOTE_MAX_CHARS = 160/);

// Mirror client validator semantics (keep in sync with supportNoteText.ts).
function normalize(raw) {
  return String(raw ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}
function words(body) {
  const value = body.trim();
  return value ? value.split(/\s+/).filter(Boolean).length : 0;
}
function validate(raw) {
  const normalized = normalize(raw);
  const count = words(normalized);
  if (!normalized || count < 1) return "NOTE_EMPTY";
  if (normalized.length > 160) return "NOTE_TOO_LONG";
  if (count > 20) return "NOTE_WORD_LIMIT";
  if (/(https?:\/\/|www\.|javascript:)/i.test(normalized)) return "NOTE_LINKS_DENIED";
  return "OK";
}

assert.equal(words(normalize("one two three")), 3);
assert.equal(validate("   "), "NOTE_EMPTY");
assert.equal(validate("a ".repeat(21)), "NOTE_WORD_LIMIT");
assert.equal(validate("a ".repeat(20)), "OK");
assert.equal(validate("hello https://evil.example"), "NOTE_LINKS_DENIED");
assert.equal(validate("<script>alert(1)</script> hi"), "OK");
assert.equal(normalize("  hello   world  "), "hello world");

const schema = read("src/services/analytics/eventSchema.ts");
assert.match(schema, /havooc_support_note_create/);
assert.match(schema, /havooc_support_note_report/);

const app = read("src/App.tsx");
assert.match(app, /HavoocSupportHubWorkspace/);
assert.match(app, /"havooc"/);

const routeMap = read("src/web/routeMap.ts");
assert.match(routeMap, /\/havooc/);
assert.match(routeMap, /\/projects\/havooc/);

console.log("havooc-support-notes-smoke: PASS");
