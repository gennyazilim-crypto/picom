import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "assets/brand/app-icon.ico",
  "assets/brand/app-icon.png",
  "assets/installer/shared/picom-installer-mark.placeholder.svg",
  "assets/installer/shared/picom-wordmark.placeholder.svg",
  "assets/installer/windows/README.md",
  "assets/installer/macos/README.md",
  "assets/installer/linux/README.md",
  "docs/installer-branding.md",
  "docs/legal/installer-license.md",
];
for (const file of requiredFiles) if (!existsSync(file)) throw new Error(`Missing installer branding asset/doc: ${file}`);

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
if (pkg.name !== "picom" || pkg.desktopName !== "Picom") throw new Error("Package identity is not Picom.");

const builder = readFileSync("electron-builder.yml", "utf8");
for (const marker of ["appId: com.picom.desktop", "productName: Picom", "installerIcon: assets/brand/app-icon.ico", "createDesktopShortcut: true", "createStartMenuShortcut: true", "target: AppImage", "target: deb", "target: dmg"]) {
  if (!builder.includes(marker)) throw new Error(`Missing package branding marker: ${marker}`);
}

const setup = readFileSync("src/components/firstLaunch/FirstLaunchSetup.tsx", "utf8");
if (/getUserMedia|desktopCapturer|requestPermission|startScreenShare/.test(setup)) throw new Error("Setup must not trigger permissions or capture.");
if (!setup.includes("onThemeChange")) throw new Error("First-launch theme selection is not wired.");

console.log("Installer/package branding and first-launch structural smoke passed.");
