import { readFile } from "node:fs/promises";
const [doc, localization, settings, appearance, dateTime, packageJson] = await Promise.all([
  readFile("docs/localization-expansion.md", "utf8"),
  readFile("src/services/localizationService.ts", "utf8"),
  readFile("src/services/settingsService.ts", "utf8"),
  readFile("src/services/appearanceService.ts", "utf8"),
  readFile("src/services/dateTimeService.ts", "utf8"),
  readFile("package.json", "utf8"),
]);
const checks = [
  [doc.includes("typed catalog") && doc.includes("English is the fallback"), "runtime architecture"],
  [doc.includes("User-generated") && doc.includes("never translated"), "user content boundary"],
  [localization.includes("UiLanguage") && localization.includes("const tr:") && localization.includes("const en:"), "TR/EN catalog"],
  [settings.includes("language: UiLanguage") && settings.includes("appearanceSettings"), "persisted language"],
  [appearance.includes("root.lang = appearance.language") && appearance.includes("dateTimeService.configure"), "document and date integration"],
  [dateTime.includes('"tr-TR"') && dateTime.includes('"en-US"'), "date locale"],
  [packageJson.includes('"localization:expansion:smoke"'), "command"],
];
const failed = checks.filter(([ok]) => !ok);
if (failed.length) { for (const [, label] of failed) console.error("FAIL: " + label); process.exit(1); }
for (const [, label] of checks) console.log("PASS: " + label);
