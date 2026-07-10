import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const app = read("src/App.tsx");
const chat = read("src/components/ChatMain.tsx");
const stories = read("src/components/FollowedPeopleStoriesHeader.tsx");
const sidebar = read("src/components/CommunitySidebar.tsx");
const docs = read("docs/bundle-splitting-lazy-loading.md");

for (const component of ["ProfileView", "MentionFeedMain", "SettingsModal", "VoiceRoomView"]) assert(app.includes(`const ${component} = lazy(`), `${component} must be lazy loaded`);
assert(!chat.includes('from "./VoiceRoomView"') && !chat.includes('import("../services/voiceService")'), "ChatMain still owns a duplicate voice path");
assert(stories.includes('lazy(() => import("./StoryViewerModal")') && stories.includes("<Suspense"), "Story viewer is not independently deferred");
assert(sidebar.includes('lazy(() => import("./CommunityAdminDeferredSection")') && !sidebar.includes('from "./CommunityBotsAdminSection"'), "Admin tools are not grouped behind one deferred boundary");
for (const marker of ["Profile", "Mention Feed", "StoryViewerModal", "Settings", "VoiceRoomView", "admin", "no over-splitting", "runtime regression"]) assert(docs.toLowerCase().includes(marker.toLowerCase()), `Bundle split review is missing ${marker}`);

const assetsDir = resolve(process.cwd(), "dist/assets");
assert(existsSync(assetsDir), "Run npm run build before the bundle splitting audit");
const assets = readdirSync(assetsDir);
for (const prefix of ["ProfileView-", "MentionFeedMain-", "StoryViewerModal-", "SettingsModal-", "VoiceRoomView-", "CommunityAdminDeferredSection-"]) assert(assets.some((file) => file.startsWith(prefix) && file.endsWith(".js")), `Production chunk is missing ${prefix}`);
const jsAssets = assets.filter((file) => file.endsWith(".js")).map((file) => ({ file, bytes: statSync(resolve(assetsDir, file)).size })).sort((a, b) => b.bytes - a.bytes);
console.log("Bundle split audit passed.");
for (const asset of jsAssets.slice(0, 12)) console.log(`${asset.file}: ${(asset.bytes / 1024).toFixed(1)} KB`);
