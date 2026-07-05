import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const settingsSource = readFileSync(resolve(root, "src/components/SettingsModal.tsx"), "utf8");
const feedbackSource = readFileSync(resolve(root, "src/services/feedbackService.ts"), "utf8");

const requiredSettingsText = [
  "Include diagnostics",
  "Include recent redacted logs",
  "Export diagnostics JSON",
  "feedbackService.exportSupportDiagnostics",
  "feedbackService.submitPlaceholder"
];

for (const text of requiredSettingsText) {
  if (!settingsSource.includes(text)) {
    throw new Error(`Missing Settings diagnostics UI wiring: ${text}`);
  }
}

const requiredFeedbackText = [
  "createDiagnosticsPayload",
  "redactFeedbackDraft",
  "serviceStatus",
  "recentLogs"
];

for (const text of requiredFeedbackText) {
  if (!feedbackSource.includes(text)) {
    throw new Error(`Missing feedback diagnostics service wiring: ${text}`);
  }
}

console.log("✓ Settings diagnostics controls");
console.log("✓ feedback diagnostics service wiring");
console.log("✓ settings diagnostics smoke test completed");
