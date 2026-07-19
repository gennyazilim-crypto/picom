import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "assets/brand/app-icon.ico",
  "assets/brand/app-icon.png",
  "assets/installer/shared/picom-installer-mark.placeholder.svg",
  "assets/installer/shared/picom-wordmark.placeholder.svg",
  "assets/installer/windows/README.md",
  "assets/installer/windows/installer-sidebar.bmp",
  "assets/installer/windows/installer-custom.nsh",
  "assets/installer/windows/license.html",
  "assets/installer/windows/license_en.html",
  "assets/installer/windows/license_tr.html",
  "assets/installer/macos/README.md",
  "assets/installer/macos/dmg-background.png",
  "assets/installer/linux/README.md",
  "docs/installer-branding.md",
  "docs/installer-assets.md",
  "docs/installer/bilingual-copy.md",
  "docs/installer/legal-links.json",
  "docs/legal/installer-license.md",
  "scripts/generate-installer-windows-art.py",
];
for (const file of requiredFiles) if (!existsSync(file)) throw new Error(`Missing installer branding asset/doc: ${file}`);

const legalLinks = JSON.parse(readFileSync("docs/installer/legal-links.json", "utf8"));
for (const key of ["website", "terms", "security"]) {
  const url = legalLinks?.[key]?.url;
  if (typeof url !== "string" || !url.startsWith("https://picom.gg")) {
    throw new Error(`Installer legal link ${key} must point at https://picom.gg…`);
  }
}

const customNsh = readFileSync("assets/installer/windows/installer-custom.nsh", "utf8");
if (!customNsh.includes("MUI_FINISHPAGE_LINK_LOCATION \"https://picom.gg\"")) {
  throw new Error("NSIS finish-page link must point at https://picom.gg");
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
if (pkg.name !== "picom" || pkg.desktopName !== "Picom Desktop") throw new Error("Package identity is not Picom.");

const builder = readFileSync("electron-builder.yml", "utf8");
for (const marker of ["appId: com.picom.desktop", "productName: Picom Desktop", "installerIcon: assets/brand/app-icon.ico", "createDesktopShortcut: true", "createStartMenuShortcut: true", "target: AppImage", "target: deb", "target: dmg"]) {
  if (!builder.includes(marker)) throw new Error(`Missing package branding marker: ${marker}`);
}
for (const marker of [
  "oneClick: false",
  "perMachine: false",
  "allowElevation: false",
  "runAfterFinish: true",
  "deleteAppDataOnUninstall: false",
  "installerSidebar: assets/installer/windows/installer-sidebar-v2.bmp",
  "license: assets/installer/windows/license.html",
  "include: assets/installer/windows/installer-custom.nsh",
  "displayLanguageSelector: true",
  "multiLanguageInstaller: true",
  "en_US",
  "tr_TR",
]) {
  if (!builder.includes(marker)) throw new Error(`Missing safe Windows installer marker: ${marker}`);
}
if (builder.includes("installerHeader:")) throw new Error("NSIS installerHeader was removed; do not reintroduce the top header strip.");
for (const marker of ["background: assets/installer/macos/dmg-background.png", "path: /Applications", "NSMicrophoneUsageDescription", "NSScreenCaptureUsageDescription"]) {
  if (!builder.includes(marker)) throw new Error(`Missing macOS installer marker: ${marker}`);
}
for (const marker of ["synopsis: Desktop community workspace", "Comment: Desktop community workspace", "Categories: Network;Chat;Utility;", 'Terminal: "false"', "StartupWMClass: Picom Desktop"]) {
  if (!builder.includes(marker)) throw new Error(`Missing Linux installer marker: ${marker}`);
}
if (builder.includes(".placeholder.")) throw new Error("Placeholder installer artwork must not be referenced by packaging.");

const setup = readFileSync("src/components/firstLaunch/FirstLaunchSetup.tsx", "utf8");
if (/getUserMedia|desktopCapturer|requestPermission|startScreenShare/.test(setup)) throw new Error("Setup must not trigger permissions or capture.");
if (!setup.includes("onThemeChange")) throw new Error("First-launch theme selection is not wired.");

console.log("Installer/package branding and first-launch structural smoke passed.");
