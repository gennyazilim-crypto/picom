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

function assertNotMatches(text, pattern, label) {
  assertCondition(!pattern.test(text), label);
}

function assertFile(path) {
  assertCondition(existsSync(resolve(root, path)), `Required packaging asset is missing: ${path}`);
}

const packageJson = JSON.parse(readText("package.json"));
const packageJsonText = JSON.stringify(packageJson, null, 2);
const builderConfig = readText("electron-builder.yml");
const appConfig = readText("electron/appConfig.cts");
const mainProcess = readText("electron/main.cts");
const preload = readText("electron/preload.cts");
const gitignore = readText(".gitignore");

assertCondition(packageJson.name === "picom", "package.json name must remain picom.");
assertCondition(packageJson.private === true, "package.json private must remain true.");
assertCondition(packageJson.main === "dist-electron/main.cjs", "package.json main must point to dist-electron/main.cjs.");
assertCondition(packageJson.scripts?.package, "package script is missing.");
assertCondition(packageJson.scripts?.["package:verify"], "package verification script is missing.");
assertCondition(packageJson.scripts?.["package:win:dir"], "Windows unpacked package script is missing.");
assertCondition(packageJson.scripts?.["package:win"], "Windows package script is missing.");
assertCondition(packageJson.scripts?.["package:linux:appimage"], "Linux AppImage package script is missing.");
assertCondition(packageJson.scripts?.["package:linux:deb"], "Linux deb package script is missing.");
assertCondition(packageJson.scripts?.["package:linux"], "Linux package script is missing.");
assertCondition(packageJson.scripts?.["package:mac:dmg"], "macOS dmg package script is missing.");
assertCondition(packageJson.scripts?.["package:mac:zip"], "macOS zip package script is missing.");
assertCondition(packageJson.scripts?.["package:mac"], "macOS package script is missing.");

assertIncludes(builderConfig, "appId: com.picom.desktop", "electron-builder appId");
assertIncludes(builderConfig, "productName: Picom", "electron-builder productName");
assertIncludes(builderConfig, "copyright: Copyright (c) 2026 Picom", "ASCII-safe copyright metadata");
assertIncludes(builderConfig, "output: release", "package output directory");
assertIncludes(builderConfig, "buildResources: assets/brand", "package build resources directory");
assertIncludes(builderConfig, "target: nsis", "Windows NSIS target");
assertIncludes(builderConfig, "target: AppImage", "Linux AppImage target");
assertIncludes(builderConfig, "target: deb", "Linux deb target");
assertIncludes(builderConfig, "target: dmg", "macOS dmg target");
assertIncludes(builderConfig, "target: zip", "macOS zip target");
assertIncludes(builderConfig, "artifactName: Picom-${version}-Windows-${arch}.${ext}", "Windows artifact name");
assertIncludes(builderConfig, "artifactName: Picom-${version}-Linux-${arch}.${ext}", "Linux artifact name");
assertIncludes(builderConfig, "artifactName: Picom-${version}-macOS-${arch}.${ext}", "macOS artifact name");
assertIncludes(builderConfig, "requestedExecutionLevel: asInvoker", "Windows installer privilege level");
assertIncludes(builderConfig, "oneClick: false", "Windows assisted installer");
assertIncludes(builderConfig, "allowToChangeInstallationDirectory: true", "Windows custom install directory");
assertIncludes(builderConfig, "createDesktopShortcut: true", "Windows desktop shortcut");
assertIncludes(builderConfig, "createStartMenuShortcut: true", "Windows start menu shortcut");
assertIncludes(builderConfig, "category: Network", "Linux desktop category");
assertIncludes(builderConfig, "executableName: Picom", "Linux executable name");
assertIncludes(builderConfig, "maintainer: Picom Contributors", "Linux maintainer placeholder");
assertIncludes(builderConfig, "description: Picom is a premium Electron desktop community chat app for focused groups.", "Linux package description");
assertIncludes(builderConfig, "packageCategory: net", "Debian package category");
assertIncludes(builderConfig, "category: public.app-category.social-networking", "macOS app category");
assertIncludes(builderConfig, "hardenedRuntime: false", "macOS unsigned local runtime placeholder");
assertIncludes(builderConfig, "gatekeeperAssess: false", "macOS local gatekeeper placeholder");
assertIncludes(builderConfig, "NSMicrophoneUsageDescription", "macOS microphone usage description");
assertIncludes(builderConfig, "NSScreenCaptureUsageDescription", "macOS screen capture usage description");
assertIncludes(builderConfig, "title: Picom ${version}", "macOS dmg title");
assertIncludes(builderConfig, "publish: null", "publish config");
assertIncludes(builderConfig, "asar: true", "asar packaging");
assertIncludes(builderConfig, "protocols:", "custom protocol registration");
assertIncludes(builderConfig, "name: Picom Protocol", "custom protocol name");
assertIncludes(builderConfig, "- picom", "custom protocol scheme");
assertIncludes(builderConfig, "main: dist-electron/main.cjs", "packaged Electron main entry");
assertIncludes(builderConfig, "dist/**/*", "renderer build files");
assertIncludes(builderConfig, "dist-electron/**/*", "Electron build files");
assertNotMatches(
  builderConfig,
  /^(?!\s*#)\s*(certificateFile|certificatePassword|identity|appleId|appleIdPassword|notarize):/m,
  "Packaging config must not contain active signing or notarization secrets."
);
assertNotMatches(packageJsonText, /discord/i, "Package metadata must not contain Discord branding.");
assertNotMatches(builderConfig, /discord/i, "Electron Builder metadata must not contain Discord branding.");
assertNotMatches(appConfig, /discord/i, "Electron app config must not contain Discord branding.");

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
assertIncludes(mainProcess, "allowRunningInsecureContent: false", "blocked insecure content");
assertIncludes(mainProcess, "devTools: !app.isPackaged", "devtools disabled in packaged builds");
assertIncludes(mainProcess, 'window.webContents.on("will-navigate"', "blocked top-level external navigation");
assertIncludes(mainProcess, 'window.webContents.on("will-attach-webview"', "blocked webview attachment");
assertIncludes(mainProcess, 'app.setAsDefaultProtocolClient("picom"', "registered Picom protocol handler");
assertIncludes(mainProcess, 'app.on("open-url"', "macOS protocol open-url handler");
assertIncludes(mainProcess, 'app.on("second-instance"', "second-instance protocol forwarding");
assertIncludes(mainProcess, "isSupportedPicomDeepLink", "native deep link route allowlist");

assertIncludes(preload, "contextBridge.exposeInMainWorld", "safe preload bridge");
assertIncludes(preload, "picomDesktop", "Picom preload namespace");
assertIncludes(preload, "Object.freeze(bridge)", "frozen preload bridge");
assertIncludes(preload, "deepLinks", "preload deep link bridge");
assertIncludes(preload, "isSupportedPicomDeepLink", "preload deep link route allowlist");

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
