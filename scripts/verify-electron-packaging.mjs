import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function readText(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(text, expected, label) {
  assertCondition(text.includes(expected), `${label} is missing: ${expected}`);
}

function assertFile(path) {
  assertCondition(existsSync(resolve(root, path)), `Required packaging asset is missing: ${path}`);
}

const packageJson = JSON.parse(readText("package.json"));
const builderConfig = readText("electron-builder.yml");
const appConfig = readText("electron/appConfig.cts");
const mainProcess = readText("electron/main.cts");
const preload = readText("electron/preload.cts");
const gitignore = readText(".gitignore");

assertCondition(packageJson.name === "picom", "package.json name must remain picom.");
assertCondition(packageJson.main === "dist-electron/main.cjs", "package.json main must point to dist-electron/main.cjs.");
assertCondition(packageJson.scripts?.package, "package script is missing.");
assertCondition(packageJson.scripts?.["package:win"], "Windows package script is missing.");
assertCondition(packageJson.scripts?.["package:linux"], "Linux package script is missing.");
assertCondition(packageJson.scripts?.["package:mac"], "macOS package script is missing.");

assertIncludes(builderConfig, "appId: com.picom.desktop", "electron-builder appId");
assertIncludes(builderConfig, "productName: Picom", "electron-builder productName");
assertIncludes(builderConfig, "copyright: Copyright (c) 2026 Picom", "ASCII-safe copyright metadata");
assertIncludes(builderConfig, "target: nsis", "Windows NSIS target");
assertIncludes(builderConfig, "target: AppImage", "Linux AppImage target");
assertIncludes(builderConfig, "target: deb", "Linux deb target");
assertIncludes(builderConfig, "target: dmg", "macOS dmg target");
assertIncludes(builderConfig, "target: zip", "macOS zip target");
assertIncludes(builderConfig, "publish: null", "publish config");

assertIncludes(appConfig, 'name: "Picom"', "Electron app name");
assertIncludes(appConfig, 'appId: "com.picom.desktop"', "Electron app id");
assertIncludes(appConfig, "defaultWidth: 1440", "default window width");
assertIncludes(appConfig, "defaultHeight: 900", "default window height");
assertIncludes(appConfig, "minWidth: 1100", "minimum window width");
assertIncludes(appConfig, "minHeight: 700", "minimum window height");

assertIncludes(mainProcess, "frame: false", "frameless custom chrome");
assertIncludes(mainProcess, "autoHideMenuBar: true", "hidden native menu bar");
assertIncludes(mainProcess, "Menu.setApplicationMenu(null)", "disabled native application menu");
assertIncludes(mainProcess, "contextIsolation: true", "context isolation");
assertIncludes(mainProcess, "nodeIntegration: false", "disabled node integration");
assertIncludes(mainProcess, "sandbox: true", "renderer sandbox");
assertIncludes(mainProcess, "webSecurity: true", "web security");
assertIncludes(mainProcess, 'window.webContents.on("will-navigate"', "blocked top-level external navigation");

assertIncludes(preload, "contextBridge.exposeInMainWorld", "safe preload bridge");
assertIncludes(preload, "picomDesktop", "Picom preload namespace");
assertIncludes(preload, "Object.freeze(bridge)", "frozen preload bridge");

assertIncludes(gitignore, "dist/", "ignored renderer build output");
assertIncludes(gitignore, "dist-electron/", "ignored Electron build output");
assertIncludes(gitignore, "release/", "ignored package output");

assertFile("assets/brand/app-icon.ico");
assertFile("assets/brand/app-icon.png");
assertFile("assets/brand/app-icon.svg");
assertFile("assets/brand/icons/16x16.png");
assertFile("assets/brand/icons/32x32.png");
assertFile("assets/brand/icons/64x64.png");
assertFile("assets/brand/icons/128x128.png");
assertFile("assets/brand/icons/256x256.png");
assertFile("assets/brand/icons/512x512.png");
assertFile("assets/brand/icons/1024x1024.png");
assertFile("docs/windows-smoke-test.md");
assertFile("docs/linux-smoke-test.md");
assertFile("docs/macos-smoke-test.md");
assertFile("docs/electron-packaging.md");
assertFile("docs/packaging-hardening.md");

console.log("Electron packaging config verification passed.");
