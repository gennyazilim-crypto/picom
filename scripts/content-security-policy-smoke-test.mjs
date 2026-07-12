import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, relative, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docPath = resolve(root, "docs/content-security-policy.md");
const viteConfigPath = resolve(root, "vite.config.ts");
if (!existsSync(docPath)) throw new Error("Missing docs/content-security-policy.md");

const doc = readFileSync(docPath, "utf8");
for (const phrase of ["Production enforcement", "default-src 'self'", "object-src 'none'", "frame-src 'none'", "VITE_SUPABASE_URL", "VITE_LIVEKIT_URL"]) {
  if (!doc.includes(phrase)) throw new Error(`CSP document missing required coverage: ${phrase}`);
}

const sourceFiles = [];
function collectSourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) collectSourceFiles(fullPath);
    else if (/\.(?:ts|tsx)$/.test(entry.name)) sourceFiles.push(fullPath);
  }
}
collectSourceFiles(resolve(root, "src"));
sourceFiles.push(resolve(root, "index.html"));

for (const file of sourceFiles) {
  const source = readFileSync(file, "utf8");
  if (source.includes("dangerouslySetInnerHTML") || /\.innerHTML\s*=/.test(source)) throw new Error(`${relative(root, file)} uses unsafe HTML rendering`);
  if ((file.endsWith(".tsx") || file.endsWith(".html")) && /<(?:webview|iframe|object)(?:\s|>)/i.test(source)) throw new Error(`${relative(root, file)} embeds forbidden content`);
}

const viteConfig = readFileSync(viteConfigPath, "utf8");
for (const directive of ["default-src 'self'", "script-src 'self'", "object-src 'none'", "frame-src 'none'", "frame-ancestors 'none'", "connect-src 'self'", "form-action 'none'"]) {
  if (!viteConfig.includes(directive)) throw new Error(`Production Vite CSP is missing ${directive}`);
}
for (const marker of ["VITE_SUPABASE_URL", "VITE_LIVEKIT_URL", "safeOrigin", "httpOrigin(env.VITE_LIVEKIT_URL)", "realtimeOrigin(env.VITE_LIVEKIT_URL)", "Content-Security-Policy", "SECURITY_HEADERS"]) {
  if (!viteConfig.includes(marker)) throw new Error(`Vite CSP integration is missing ${marker}`);
}
const productionSection = viteConfig.slice(viteConfig.indexOf("CSP_PRODUCTION_DIRECTIVES"), viteConfig.indexOf("return CSP_PRODUCTION_DIRECTIVES"));
if (productionSection.includes("unsafe-eval")) throw new Error("Production CSP must not allow unsafe-eval");

const builtIndex = resolve(root, "dist/index.html");
if (!existsSync(builtIndex) || !readFileSync(builtIndex, "utf8").includes("Content-Security-Policy")) throw new Error("Built renderer index is missing enforced CSP metadata; run npm run build first");

const electronMain = readFileSync(resolve(root, "electron/main.cts"), "utf8");
for (const guard of ["setWindowOpenHandler", "will-navigate", "will-attach-webview", "allowRunningInsecureContent: false", "webSecurity: true"]) {
  if (!electronMain.includes(guard)) throw new Error(`Electron navigation/content guard missing: ${guard}`);
}

console.log("Content Security Policy production smoke test passed.");
