import { readFile } from "node:fs/promises";

const [service, component, app, docs, packageJson] = await Promise.all([
  readFile("src/services/shortcutService.ts", "utf8"),
  readFile("src/components/KeyboardShortcutsSection.tsx", "utf8"),
  readFile("src/App.tsx", "utf8"),
  readFile("docs/keyboard-shortcuts-customization.md", "utf8"),
  readFile("package.json", "utf8"),
]);

const checks = [
  [service.includes("picom:keyboard-shortcuts:v1") && service.includes("localStorage"), "local persistence"],
  [service.includes("CONFLICT") && service.includes("OS_RESERVED") && service.includes("reserved"), "conflict and reserved protection"],
  [service.includes("resetDefaults") && component.includes("Reset defaults"), "default reset"],
  [component.includes("Press keys...") && component.includes("role=\"status\""), "editing UX"],
  [app.includes('matchesEvent("commandPalette"') && app.includes("isEditableTarget"), "runtime bindings"],
  [docs.includes("Alt+F4") && docs.includes("Escape") && docs.includes("Native/global OS shortcuts remain out of scope"), "documentation"],
  [packageJson.includes('"shortcuts:customization:smoke"'), "package script"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, label] of failed) console.error(`FAIL: ${label}`);
  process.exit(1);
}
for (const [, label] of checks) console.log(`PASS: ${label}`);
