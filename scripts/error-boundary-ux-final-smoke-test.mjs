import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const boundary = read("src/components/DesktopStartupErrorBoundary.tsx");
const styles = read("src/styles.css");
const docs = read("docs/error-boundary-ux-final.md");

for (const marker of ["Restart Picom", "Open Safe Mode", "Export support logs", "Copy support details", "safeModeService.exportLogs()", "crashRecoveryService.restartRenderer()"])
  assert(boundary.includes(marker), `Fatal recovery UI is missing ${marker}`);
assert(boundary.includes("import.meta.env.DEV ?") && boundary.includes("Developer diagnostics (local development only)"), "Developer diagnostics are not development-gated");
assert(!boundary.includes("<p>{this.state.error.message}</p>") && !boundary.includes("<p>{userMessage}</p>"), "Raw error text is rendered in the user-facing screen");
for (const marker of ["var(--window-backdrop)", "var(--surface)", "var(--border)", "var(--text-primary)", "var(--focus-ring)"])
  assert(styles.includes(marker), `Error boundary styling is missing token ${marker}`);
for (const marker of ["restart", "Safe Mode", "export support logs", "redacted", "development", "light and dark"])
  assert(docs.toLowerCase().includes(marker.toLowerCase()), `Error boundary UX documentation is missing ${marker}`);

console.log("Fatal error boundary UX audit passed.");
