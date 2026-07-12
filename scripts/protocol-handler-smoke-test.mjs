import fs from "node:fs";

const files = {
  main: "electron/main.cts",
  preload: "electron/preload.cts",
  validation: "electron/ipcPayloadValidation.cts",
  oauth: "electron/oauthFoundation.cts",
  channels: "electron/ipcChannels.cts",
  builder: "electron-builder.yml",
  renderer: "src/services/deepLinkService.ts",
  social: "src/services/auth/socialAuthService.ts",
  storage: "src/services/auth/secureAuthStorage.ts",
  doc: "docs/deep-links.md",
  types: "src/types/picomDesktop.d.ts",
};
const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, "utf8")]));
const required = [
  [text.main, "app.setAsDefaultProtocolClient(\"picom\""],
  [text.main, "app.on(\"open-url\""],
  [text.main, "app.on(\"second-instance\""],
  [text.main, "parseOAuthCallbackUrl"],
  [text.main, "authOAuthGetPendingResult"],
  [text.validation, "parseOAuthCallbackUrl"],
  [text.validation, "attempt_id"],
  [text.validation, "state"],
  [text.validation, "nonce"],
  [text.oauth, "OAUTH_CALLBACK_REPLAYED"],
  [text.oauth, "ProtectedAuthStore"],
  [text.preload, "onOAuthResult"],
  [text.channels, "authSecureStorageGet"],
  [text.builder, "protocols:"],
  [text.builder, "name: Picom Protocol"],
  [text.builder, "- picom"],
  [text.renderer, "parseDeepLink"],
  [text.types, "secureStorage"],
  [text.social, "startOAuthAttempt"],
  [text.storage, "memory_only"],
  [text.doc, "Deep links never execute shell commands"],
  [text.doc, "Unknown routes fail closed"],
];
const missing = required.filter(([textValue, needle]) => !textValue.includes(needle)).map(([, needle]) => needle);
if (missing.length) {
  console.error("Protocol/OAuth wiring is missing: " + missing.join(", "));
  process.exit(1);
}
for (const pattern of [/shell\.openPath\(/, /child_process/, /execFile/]) {
  if (pattern.test(text.main + "\n" + text.preload)) {
    console.error("Forbidden protocol execution pattern: " + pattern);
    process.exit(1);
  }
}
console.log("Desktop protocol and secure OAuth wiring smoke passed.");
