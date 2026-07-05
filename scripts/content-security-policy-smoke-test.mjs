import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docPath = resolve(root, "docs/content-security-policy.md");

if (!existsSync(docPath)) {
  throw new Error("Missing docs/content-security-policy.md");
}

const doc = readFileSync(docPath, "utf8");
const requiredDocPhrases = [
  "default-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "connect-src",
  "Supabase",
  "LiveKit",
  "Do not enforce a production CSP in this task",
];

const missingDocPhrases = requiredDocPhrases.filter((phrase) => !doc.includes(phrase));
if (missingDocPhrases.length > 0) {
  throw new Error(`CSP document missing required coverage: ${missingDocPhrases.join(", ")}`);
}

const sourceFiles = [
  "index.html",
  "src/main.tsx",
  "src/App.tsx",
];

for (const file of sourceFiles) {
  const source = readFileSync(resolve(root, file), "utf8");
  if (source.includes("dangerouslySetInnerHTML")) {
    throw new Error(`${file} uses dangerouslySetInnerHTML; update CSP review before allowing unsafe HTML.`);
  }
  if (source.includes("<webview") || source.includes("<iframe")) {
    throw new Error(`${file} embeds remote frame/webview content; CSP must be updated before shipping.`);
  }
}

const electronMain = readFileSync(resolve(root, "electron/main.cts"), "utf8");
const requiredElectronGuards = [
  "setWindowOpenHandler",
  "will-navigate",
  "will-attach-webview",
  "allowRunningInsecureContent: false",
  "webSecurity: true",
];

const missingElectronGuards = requiredElectronGuards.filter((guard) => !electronMain.includes(guard));
if (missingElectronGuards.length > 0) {
  throw new Error(`Electron navigation/content guards missing: ${missingElectronGuards.join(", ")}`);
}

console.log("Content Security Policy smoke test passed.");
