import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");
const npmCommand = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm";

const activePodcastFiles = [
  "src/components/audio/PodcastCommunityShell.tsx",
  "src/components/audio/PodcastPublisherPanel.tsx",
  "src/components/audio/PodcastEpisodeDetail.tsx",
  "src/components/audio/PodcastModerationPanel.tsx",
  "src/services/audio/podcastCommunityService.ts",
  "src/services/audio/podcastPublishingService.ts",
  "src/services/audio/podcastService.ts",
  "src/services/audio/podcastRealtimeService.ts",
  "src/services/audio/podcastModerationService.ts",
];

for (const file of activePodcastFiles) {
  const source = read(file);
  if (/coming soon|placeholder opened|fake success|console\.(?:log|warn|error)|not available yet/i.test(source)) throw new Error(file + " contains a Podcast acceptance-path placeholder or console-only action.");
  if (/supabase\s*\.\s*from\s*\(/.test(source) && file.includes("components/")) throw new Error(file + " calls Supabase directly from a Podcast UI component.");
}

const detail = read("src/components/audio/PodcastEpisodeDetail.tsx");
if (!detail.includes("navigator.clipboard.writeText") || !detail.includes("picom://podcast/")) throw new Error("Podcast Share must copy the exact access-checked episode deep link.");

const mock = read("src/data/mockAudio.ts");
for (const marker of ['status: "published"', 'status: "draft"', "mockPodcastEpisodes"]) if (!mock.includes(marker)) throw new Error("Podcast mock coverage is missing " + marker + ".");
if (/audioUrl:\s*["']https?:\/\//i.test(mock) || /coverUrl:\s*["']https?:\/\//i.test(mock)) throw new Error("Mock Podcast data references external copyrighted media.");

const audioExtensions = new Set([".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac", ".opus"]);
const bundledAudio = [];
function walk(directory) {
  let entries = [];
  try { entries = readdirSync(join(root, directory), { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const relative = join(directory, entry.name);
    if (entry.isDirectory() && relative.replaceAll("\\", "/") !== "public/icons") walk(relative);
    else if (audioExtensions.has(extname(entry.name).toLowerCase())) bundledAudio.push(relative);
  }
}
walk("public");
walk("src/assets");
if (bundledAudio.length) throw new Error("Bundled Podcast fixture audio requires provenance review: " + bundledAudio.join(", "));

const scripts = [
  "community:podcast-template:smoke",
  "community:kind-permissions:smoke",
  "audio:domain:smoke",
  "audio:player:smoke",
  "audio:feed:smoke",
  "audio:profile:smoke",
  "audio:community:smoke",
  "audio:podcast:smoke",
  "podcast:data-model:smoke",
  "podcast:publishing:smoke",
  "podcast:player:smoke",
  "podcast:interactions:smoke",
  "podcast:integration:smoke",
  "podcast:moderation:smoke",
  "audio:schema:smoke",
  "audio:service:smoke",
  "audio:mvp:qa",
  "search:palette:production:test",
  "protocol-handler:smoke",
  "reports:production:test",
  "audit-logs:immutability:smoke",
  "visual:regression:contract",
  "e2e:coverage:contract",
];

for (const script of scripts) {
  const args = process.platform === "win32" ? ["/d", "/s", "/c", "npm run " + script] : ["run", script];
  const result = spawnSync(npmCommand, args, { cwd: root, stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("Podcast Full MVP local end-to-end QA passed. Hosted Supabase/Storage/Realtime and real UI-runner evidence remain separate environment gates.");
