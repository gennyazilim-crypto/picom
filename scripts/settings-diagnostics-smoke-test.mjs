import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const settingsSource = readFileSync(resolve(root, "src/components/SettingsModal.tsx"), "utf8");
const feedbackSource = readFileSync(resolve(root, "src/services/feedbackService.ts"), "utf8");
const catalogEn = readFileSync(resolve(root, "src/services/settings/settingsModalEn.ts"), "utf8");

const requiredSettingsText = [
  'ts("advanced.feedback.includeDiagnostics")',
  'ts("advanced.feedback.includeLogs")',
  "feedbackService.exportSupportDiagnostics",
  "feedbackService.copyReport",
];

for (const text of requiredSettingsText) {
  if (!settingsSource.includes(text)) {
    throw new Error(`Missing Settings diagnostics UI wiring: ${text}`);
  }
}

const requiredCatalogText = [
  '"advanced.feedback.includeDiagnostics": "Include diagnostics"',
  '"advanced.feedback.includeLogs": "Include recent redacted logs"',
  '"advanced.exportDiagnosticsJson": "Export diagnostics JSON"',
];

for (const text of requiredCatalogText) {
  if (!catalogEn.includes(text)) {
    throw new Error(`Missing Settings diagnostics catalog copy: ${text}`);
  }
}

const requiredFeedbackText = [
  "createDiagnosticsPayload",
  "redactFeedbackDraft",
  "serviceStatus",
  "recentLogs",
];

for (const text of requiredFeedbackText) {
  if (!feedbackSource.includes(text)) {
    throw new Error(`Missing feedback diagnostics service wiring: ${text}`);
  }
}

console.log("✓ Settings diagnostics controls");
console.log("✓ feedback diagnostics service wiring");
console.log("✓ settings diagnostics smoke test completed");
