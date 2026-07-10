import { readFileSync } from "node:fs";

const service = readFileSync("src/services/dataExportService.ts", "utf8");
const settings = readFileSync("src/components/SettingsModal.tsx", "utf8");
const edge = readFileSync("supabase/functions/user-data-export/index.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260710088000_user_data_export_production.sql", "utf8");
const failures = [];

for (const pattern of [/passwordHash/i, /authorizationHeader/i, /Authorization:/, /console\.(log|warn|error|info)/]) if (pattern.test(service)) failures.push(`unsafe renderer pattern: ${pattern}`);
for (const expected of ["requestExport", "downloadExportJson", "normalizeServerPayload", "isExpired", "MAX_SECTION_ROWS", "localDesktopSettings"]) if (!service.includes(expected)) failures.push(`service missing ${expected}`);
for (const expected of ["requireSupabaseUser", "begin_own_data_export", "complete_own_data_export", '.eq("author_id", auth.user.id)', '.eq("uploader_id", auth.user.id)', '.eq("follower_id", auth.user.id)', '.eq("user_id", auth.user.id)', '"Cache-Control": "no-store']) if (!edge.includes(expected)) failures.push(`edge missing ${expected}`);
if (edge.includes("operator.from(\"messages\")") || edge.includes("operator.from(\"profiles\")")) failures.push("service role must not query export content");
if (edge.includes("SUPABASE_SERVICE_ROLE_KEY") || edge.includes("createClient")) failures.push("export function must not require service-role access");
if (!migration.includes("revoke update, delete") || !migration.includes("job metadata only")) failures.push("request metadata hardening missing");
if (!settings.includes("Data export") || !settings.includes("Download JSON export")) failures.push("Settings export controls missing");
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log("User data export production smoke passed.");
