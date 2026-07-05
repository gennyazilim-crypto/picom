import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  doc: readFileSync(resolve(root, "docs/audit-log-immutability.md"), "utf8"),
  loggingService: readFileSync(resolve(root, "src/services/loggingService.ts"), "utf8"),
};

const checks = [
  [files.doc.includes("append-only"), "append-only policy"],
  [files.doc.includes("direct client-side `update`"), "client update disallowed"],
  [files.doc.includes("direct client-side `delete`"), "client delete disallowed"],
  [files.doc.includes("passwords"), "password exclusion"],
  [files.doc.includes("session tokens"), "session token exclusion"],
  [files.doc.includes("authorization headers"), "authorization header exclusion"],
  [files.doc.includes("security definer"), "trusted write function guidance"],
  [files.doc.includes("on delete set null"), "cascade delete protection"],
  [files.doc.includes("loggingService"), "central logging service relationship"],
  [files.loggingService.includes("SENSITIVE_KEY_PATTERN"), "logging redaction pattern exists"],
  [files.loggingService.includes("redactDiagnosticsValue"), "diagnostics redaction helper exists"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length > 0) {
  throw new Error(`Audit log immutability smoke test failed: ${failed.join(", ")}`);
}

console.log("Audit log immutability smoke test passed.");
