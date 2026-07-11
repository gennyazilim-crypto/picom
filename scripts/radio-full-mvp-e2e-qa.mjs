import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");
const npmCommand = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm";

const activeRadioFiles = [
  "src/components/audio/RadioCommunityShell.tsx",
  "src/components/audio/RadioPanel.tsx",
  "src/components/audio/RadioHostProducerPanel.tsx",
  "src/services/audio/radioService.ts",
  "src/services/audio/radioRepository.ts",
  "src/services/audio/radioRealtimeService.ts",
  "src/services/audio/radioScheduleReminderService.ts",
];

for (const file of activeRadioFiles) {
  const source = read(file);
  if (/coming soon|placeholder|console\.(?:log|warn|error)/i.test(source)) throw new Error(file + " contains a Radio acceptance-path placeholder or console-only action.");
}

const mock = read("src/data/mockAudio.ts");
for (const status of ['status: "live"', 'status: "scheduled"', 'status: "ended"', 'status: "cancelled"']) {
  if (!mock.includes(status)) throw new Error("Radio mock coverage is missing " + status + ".");
}
if (/audioUrl:\s*["']https?:\/\//i.test(mock) || /streamUrl:\s*["']https?:\/\//i.test(mock)) throw new Error("Mock Radio/Podcast data references an external demo stream.");

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
if (bundledAudio.length) throw new Error("Bundled demo audio requires provenance review: " + bundledAudio.join(", "));

const scripts = [
  "community:radio-template:smoke",
  "audio:domain:smoke",
  "audio:player:smoke",
  "radio:listener-player:smoke",
  "radio:scheduling-notifications:smoke",
  "audio:feed:smoke",
  "audio:profile:smoke",
  "audio:community:smoke",
  "audio:radio:smoke",
  "radio:data-model:smoke",
  "radio:service-realtime:smoke",
  "radio:host-producer:smoke",
  "radio:roles-moderation-audit:smoke",
  "radio:cross-surface:smoke",
  "audio:schema:smoke",
  "audio:service:smoke",
  "audio:mvp:qa",
  "visual:regression:contract",
  "e2e:coverage:contract",
];

for (const script of scripts) {
  const args = process.platform === "win32" ? ["/d", "/s", "/c", "npm run " + script] : ["run", script];
  const result = spawnSync(npmCommand, args, { cwd: root, stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("Radio Full MVP local end-to-end QA passed. Hosted multi-client/provider evidence remains a separate environment gate.");
