import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("src/services/desktop/externalLinkService.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const links = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

for (const url of ["https://example.com/path?q=1#section", "http://127.0.0.1:8080/status", "  https://example.com/help  "]) {
  const normalized = links.normalizeUrl(url);
  if (!normalized || !links.isSafeUrl(url) || !/^https?:/.test(normalized)) throw new Error(`Safe HTTP(S) URL rejected: ${url}`);
}

const blocked = [
  "javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  "file:///C:/Windows/System32/calc.exe",
  "data:text/html,<script>alert(1)</script>",
  "vbscript:msgbox(1)",
  "shell:calc",
  "cmd:whoami",
  "powershell:Start-Process calc",
  "ms-settings:privacy",
  "ftp://example.com/file",
  "picom://settings",
  "myapp://settings",
  "//example.com/path",
  "https://user:password@example.com/path",
  "https://example.com/" + "a".repeat(2050),
  "not a URL",
  "",
];
for (const url of blocked) {
  if (links.normalizeUrl(url) !== null || links.isSafeUrl(url)) throw new Error(`Unsafe URL accepted: ${url.slice(0, 100)}`);
  if (links.getDisplayDomain(url) !== "Blocked link") throw new Error(`Blocked URL exposed a display domain: ${url.slice(0, 100)}`);
}

let nativeCalls = 0;
let lastNativeUrl = "";
globalThis.window = {
  picomDesktop: {
    externalLinks: {
      openUrl: async (url) => {
        nativeCalls += 1;
        lastNativeUrl = url;
        return { ok: true, native: true, url };
      },
    },
  },
};
const opened = await links.openExternalUrl(" https://example.com/help ");
if (!opened.ok || !opened.native || nativeCalls !== 1 || lastNativeUrl !== "https://example.com/help") throw new Error("Safe native external opening contract failed");
for (const url of blocked) await links.openExternalUrl(url);
if (nativeCalls !== 1) throw new Error("Blocked URL reached native opener");

const internal = await links.openExternalUrl("picom://settings");
if (internal.ok || internal.reason !== "INTERNAL_LINK_REQUIRES_DEEP_LINK_SERVICE") throw new Error("Internal deep link did not fail closed");
if (!links.getUserFriendlyError("UNSAFE_EXTERNAL_URL").toLowerCase().includes("blocked")) throw new Error("Blocked link lacks user-facing explanation");

globalThis.window = { open: () => null };
const popupBlocked = await links.openExternalUrl("https://example.com/help");
if (popupBlocked.ok || popupBlocked.reason !== "EXTERNAL_URL_OPEN_FAILED") throw new Error("Blocked browser popup returned false success");

const messageItem = fs.readFileSync("src/components/MessageItem.tsx", "utf8");
if (!messageItem.includes("externalLinkService.openExternalUrl") || !messageItem.includes("getUserFriendlyError") || !messageItem.includes("pushToast")) throw new Error("Message link blocked state is not user visible");

console.log("Safe external links production test passed.");
