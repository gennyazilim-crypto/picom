import fs from "node:fs";

const doc = fs.readFileSync("docs/forum-channel-placeholder.md", "utf8");
const required = [
  "post-MVP placeholder",
  "forum",
  "forum_posts",
  "Supabase/RLS",
  "ForumChannelView",
  "enableForumChannels",
  "documentation-only"
];

const missing = required.filter((needle) => !doc.includes(needle));
if (missing.length) {
  console.error(`Forum channel placeholder doc is missing: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Forum channel placeholder smoke passed.");
