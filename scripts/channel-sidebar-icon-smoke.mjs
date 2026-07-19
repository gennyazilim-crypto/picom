import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [util, item, templates] = await Promise.all([
  read("src/utils/channelSidebarIcon.ts"),
  read("src/components/ChannelItem.tsx"),
  read("src/data/communityTemplates.ts"),
]);

const checks = [
  [util.includes("resolveChannelSidebarIcon"), "sidebar icon resolver is exported"],
  [util.includes('icon: "bell"'), "announcement names map to bell"],
  [util.includes('icon: "users"'), "general chat maps to users"],
  [util.includes('icon: "lock"'), "rules/private map to lock"],
  [util.includes("channel.isPrivate"), "private channels prefer lock"],
  [item.includes("resolveChannelSidebarIcon"), "ChannelItem uses the resolver"],
  [!item.includes("sidebarIcons.textChannel"), "ChannelItem no longer hardcodes hash for all text"],
  [!templates.includes('name: "announcements", type: "text"'), "templates mark announcements as announcement type"],
  [templates.includes('name: "announcements", type: "announcement"'), "templates use announcement channel type"],
];

const failures = checks.filter(([passed]) => !passed).map(([, label]) => label);
if (failures.length) {
  console.error(`Channel sidebar icon smoke failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`Channel sidebar icon smoke passed (${checks.length} checks).`);
