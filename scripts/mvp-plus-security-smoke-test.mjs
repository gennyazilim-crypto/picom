import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function assert(condition, message) { if (!condition) throw new Error(message); }

const rendererSources = fs.readdirSync("src/services", { recursive: true })
  .filter((entry) => typeof entry === "string" && entry.endsWith(".ts"))
  .map((entry) => read(`src/services/${entry.replaceAll("\\", "/")}`))
  .join("\n");
const app = read("src/App.tsx");
const profiles = read("src/data/mockProfiles.ts");
const uploads = read("src/services/uploadService.ts");
const fileService = read("src/services/fileService.ts");
const hardening = read("supabase/migrations/20260710004800_mvp_plus_security_hardening.sql");

assert(!/VITE_SUPABASE_SERVICE_ROLE|VITE_LIVEKIT_API_SECRET/.test(rendererSources), "Privileged server secret name found in renderer services");
assert(!app.includes("dangerouslySetInnerHTML"), "App must not render unsafe HTML");
assert(app.includes("visibleMentionItems") && app.includes("canViewChannel(access, channel)"), "Mention feed must filter inaccessible channels");
assert(profiles.includes("filterCommunitiesForViewer") && profiles.includes("canViewChannel(access, channel)"), "Profile activity/media must filter inaccessible channels");
assert(uploads.includes("validateContent") && fileService.includes("INVALID_FILE_SIGNATURE"), "Upload content signatures must be checked");
assert(hardening.includes("direct_attachments_insert_uploader_author"), "DM attachment author policy missing");
assert(hardening.includes("events_select_visible_channel_member_or_public"), "Event channel visibility policy missing");
assert(hardening.includes("revoke select on public.webhooks"), "Webhook hash column must not be client-selectable");
assert(hardening.includes("grant update (status, reviewed_by, updated_at)"), "Report updates must be column-limited");

console.log("OK MVP+ security hardening smoke test completed");
