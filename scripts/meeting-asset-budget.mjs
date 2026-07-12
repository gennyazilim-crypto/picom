import { gzipSync } from "node:zlib";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const KB = 1024;
const manifestPath = path.join("dist", ".vite", "manifest.json");
const budgetPath = path.join("config", "meeting-performance-budgets.json");
const reportPath = path.join("dist", "meeting-asset-report.json");
const assetPath = (file) => path.join("dist", file.replaceAll("/", path.sep));
const format = (bytes) => `${(bytes / KB).toFixed(1)} KiB`;

let manifest;
let budget;
try {
  [manifest, budget] = await Promise.all([
    readFile(manifestPath, "utf8").then(JSON.parse),
    readFile(budgetPath, "utf8").then(JSON.parse),
  ]);
} catch (error) {
  console.error(`FAIL meeting asset budget setup: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const entries = Object.entries(manifest);
const rendererEntries = entries.filter(([, record]) => record.isEntry === true).map(([key]) => key);
const meetingKey = entries.find(([key]) => key === "src/components/meeting/MeetingWorkspace.tsx")?.[0];
const screenShareKey = entries.find(([key]) => key === "src/components/meeting/MeetingScreenShareFocus.tsx")?.[0];
if (!rendererEntries.length || !meetingKey || !screenShareKey) {
  console.error("FAIL: renderer, MeetingWorkspace, or MeetingScreenShareFocus is missing from the Vite manifest.");
  process.exit(1);
}

function collectStaticGraph(roots) {
  const keys = new Set();
  const visit = (key) => {
    if (keys.has(key)) return;
    const record = manifest[key];
    if (!record) throw new Error(`Missing manifest import ${key}`);
    keys.add(key);
    for (const imported of record.imports ?? []) visit(imported);
  };
  for (const root of roots) visit(root);
  return keys;
}

const initialKeys = collectStaticGraph(rendererEntries);
const meetingKeys = collectStaticGraph([meetingKey]);
const incrementalKeys = new Set([...meetingKeys].filter((key) => !initialKeys.has(key)));
const forbiddenInitial = [...initialKeys].filter((key) => /MeetingWorkspace|MeetingScreenShareFocus|meetingLiveKitAdapter|(?:^|\/)voiceService\.ts$/i.test(key));
const meetingDynamicImports = new Set([...meetingKeys].flatMap((key) => manifest[key]?.dynamicImports ?? []));

async function describe(files, kind) {
  return Promise.all([...files].sort().map(async (file) => {
    const bytes = (await stat(assetPath(file))).size;
    const gzipBytes = gzipSync(await readFile(assetPath(file))).length;
    return { file, kind, bytes, gzipBytes };
  }));
}

function filesFor(keys, extension) {
  const files = new Set();
  for (const key of keys) {
    const record = manifest[key];
    if (extension === ".js" && record?.file?.endsWith(extension)) files.add(record.file);
    if (extension === ".css") for (const css of record?.css ?? []) files.add(css);
  }
  return files;
}

const incrementalJsFiles = filesFor(incrementalKeys, ".js");
const incrementalCssFiles = filesFor(incrementalKeys, ".css");
const meetingEntryFile = manifest[meetingKey].file;
const screenShareFile = manifest[screenShareKey].file;
const assets = [
  ...await describe(incrementalJsFiles, "meeting-static-js"),
  ...await describe(incrementalCssFiles, "meeting-static-css"),
];
const byFile = new Map(assets.map((asset) => [asset.file, asset]));
const measurement = {
  meetingEntryJsRawBytes: byFile.get(meetingEntryFile)?.bytes ?? 0,
  meetingIncrementalJsRawBytes: assets.filter((asset) => asset.kind === "meeting-static-js").reduce((sum, asset) => sum + asset.bytes, 0),
  meetingIncrementalCssRawBytes: assets.filter((asset) => asset.kind === "meeting-static-css").reduce((sum, asset) => sum + asset.bytes, 0),
  screenShareFocusJsRawBytes: (await stat(assetPath(screenShareFile))).size,
};

let failed = false;
console.log("Picom meeting asset budget");
if (initialKeys.has(meetingKey) || forbiddenInitial.length) {
  failed = true;
  console.error(`FAIL: heavy meeting code entered the renderer startup graph: ${[meetingKey, ...forbiddenInitial].join(", ")}`);
} else {
  console.log("PASS: MeetingWorkspace, LiveKit media, and screen-share focus remain outside the renderer startup graph.");
}
if (meetingKeys.has(screenShareKey) || !meetingDynamicImports.has(screenShareKey)) {
  failed = true;
  console.error("FAIL: MeetingScreenShareFocus is not isolated as a dynamic meeting chunk.");
} else {
  console.log("PASS: MeetingScreenShareFocus remains dynamically loaded inside the meeting workspace.");
}
for (const [name, value] of Object.entries(measurement)) {
  const limits = budget.assetBudgets[name];
  if (!limits) throw new Error(`Missing asset budget ${name}`);
  if (value > limits.hard) {
    failed = true;
    console.error(`FAIL: ${name} ${format(value)} exceeds hard cap ${format(limits.hard)}.`);
  } else if (value > limits.target) {
    console.warn(`WARN: ${name} ${format(value)} exceeds target ${format(limits.target)} but remains below hard cap ${format(limits.hard)}.`);
  } else {
    console.log(`PASS: ${name} ${format(value)} <= target ${format(limits.target)}.`);
  }
}

for (const asset of [...assets].sort((left, right) => right.bytes - left.bytes)) {
  console.log(`${asset.kind.padEnd(18)} | ${format(asset.bytes).padStart(10)} | gzip ${format(asset.gzipBytes).padStart(10)} | ${asset.file}`);
}

await writeFile(reportPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  basis: "raw Vite manifest static graph unique to lazy MeetingWorkspace; gzip informational; nested dynamic imports excluded",
  rendererEntries,
  meetingEntry: meetingKey,
  meetingDynamicImports: [...meetingDynamicImports].sort(),
  measurement,
  budgets: budget.assetBudgets,
  assets,
}, null, 2)}\n`, "utf8");

console.log(`Meeting asset report written to ${reportPath}.`);
if (failed) process.exit(1);
