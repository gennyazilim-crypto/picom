/**
 * Ensures desktop renderer entry wires CompanionApp for Electron companion windows.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const MAIN = join(ROOT, "src/main.tsx");
const TYPES = join(ROOT, "src/features/companion/companionTypes.ts");
const APP = join(ROOT, "src/features/companion/CompanionApp.tsx");

test("companionTypes exports isCompanionWindowSearch", () => {
  const src = readFileSync(TYPES, "utf8");
  assert.match(src, /export function isCompanionWindowSearch/);
  assert.match(src, /\.get\(\s*["']picomWindow["']\s*\)\s*===\s*["']companion["']/);
});

test("main.tsx imports and mounts CompanionApp for companion windows", () => {
  const src = readFileSync(MAIN, "utf8");
  assert.match(src, /from ["']\.\/features\/companion\/CompanionApp["']/);
  assert.match(src, /from ["']\.\/features\/companion\/companionTypes["']/);
  assert.match(src, /isCompanionWindowSearch/);
  assert.match(src, /<CompanionApp\s*\/>/);
  assert.match(src, /function DesktopRendererRoot/);
  assert.match(src, /<DesktopRendererRoot\s*\/>/);
  assert.match(src, /companionWindow\s*\?\s*<CompanionApp/);
});

test("CompanionApp routes missing auth away from blank error shell", () => {
  const src = readFileSync(APP, "utf8");
  assert.match(src, /function isCompanionAuthRequiredError/);
  assert.match(src, /function AuthRequiredState/);
  assert.match(src, /returnToMainMode/);
  assert.match(src, /Oturum gerekli/);
});

test("electron companion windows load picomWindow=companion query", () => {
  const src = readFileSync(join(ROOT, "electron/companionWindowManager.cts"), "utf8");
  assert.match(src, /picomWindow:\s*["']companion["']/);
  assert.match(src, /searchParams\.set/);
});

test("WindowTitleBar exposes Companion mode enter button", () => {
  const src = readFileSync(join(ROOT, "src/components/WindowTitleBar.tsx"), "utf8");
  const css = readFileSync(join(ROOT, "src/components/WindowTitleBar.css"), "utf8");
  assert.match(src, /window-titlebar-companion-button/);
  assert.match(src, /companion\?\.enterMode/);
  assert.match(src, /appConfig\.features\.companionMode/);
  assert.match(css, /\.window-titlebar-companion-button/);
});
