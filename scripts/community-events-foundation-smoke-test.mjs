import fs from "node:fs";

const doc = fs.readFileSync("docs/community-events-scheduled-sessions.md", "utf8");
const required = [
  "post-MVP foundation",
  "community_events",
  "community_event_rsvps",
  "Supabase Auth and RLS",
  "LiveKit token Edge Function",
  "Do not log passwords",
  "enableCommunityEvents"
];

const missing = required.filter((needle) => !doc.includes(needle));
if (missing.length) {
  console.error(`Community events foundation doc is missing: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Community events foundation smoke passed.");
