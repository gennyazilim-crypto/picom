import fs from "node:fs";

const doc = fs.readFileSync("docs/announcement-channel-placeholder.md", "utf8");
const required = [
  "post-MVP placeholder",
  "is_announcement",
  "sendAnnouncements",
  "Supabase/RLS",
  "enableAnnouncementChannels",
  "documentation-only"
];

const missing = required.filter((needle) => !doc.includes(needle));
if (missing.length) {
  console.error(`Announcement channel placeholder doc is missing: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Announcement channel placeholder smoke passed.");
