import { readFileSync } from "node:fs";

const settings = readFileSync("src/services/settingsService.ts", "utf8");
const setup = readFileSync("src/components/firstLaunch/FirstLaunchSetup.tsx", "utf8");
const setupCopy = readFileSync("src/components/firstLaunch/firstLaunchCopy.ts", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const settingsModal = readFileSync("src/components/SettingsModal.tsx", "utf8");

for (const marker of ["firstLaunchSetupCompleted", "completeFirstLaunchSetup", "resetFirstLaunchSetup", "fromVersion: 4", "toVersion: 5"]) {
  if (!settings.includes(marker)) throw new Error(`Missing first-launch settings contract: ${marker}`);
}
for (const marker of ["Welcome to Picom", "Choose your starting theme", "Permissions are requested only when needed", "Nothing starts without your action", "Setup complete"]) {
  if (!setupCopy.includes(marker)) throw new Error(`Missing English first-launch copy: ${marker}`);
}
for (const marker of ["Picom'a hoş geldiniz", "Başlangıç temanızı seçin", "İzinler yalnızca gerektiğinde istenir", "Siz başlatmadan hiçbir şey çalışmaz", "Kurulum tamamlandı", "Daha sonra ayarla", "İzin rehberini görüntüle"]) {
  if (!setupCopy.includes(marker)) throw new Error(`Missing Turkish first-launch copy: ${marker}`);
}
if (!setup.includes("navigator.language") || !setup.includes('setLocale("tr")') || !setup.includes('setLocale("en")')) throw new Error("TR/EN setup locale selection is not wired.");
if (/getUserMedia|desktopCapturer|requestPermission|startScreenShare|voiceService/.test(setup)) throw new Error("First-launch setup must not request native/media permissions.");
if (!app.includes("!safeMode.active && !firstLaunchSetupCompleted") || !app.includes("<FirstLaunchSetup")) throw new Error("First-launch setup App integration missing.");
if (app.indexOf("<FirstLaunchSetup") > app.indexOf("if (passwordRecoveryMode || !authReady || !authSession)")) throw new Error("First-launch setup must precede unauthenticated login/register rendering.");
if (!settingsModal.includes('import.meta.env.DEV') || !settingsModal.includes("Reset first-launch setup") || !settingsModal.includes("settingsService.resetFirstLaunchSetup()")) throw new Error("Development-only first-launch reset control is missing.");
if (!settings.includes("backupInvalidSettings(raw, storage)") || !settings.includes("return cloneSettings(defaults)")) throw new Error("Corrupted settings must retain a safe-default recovery path.");

console.log("First-launch setup persistence and no-prompt smoke passed.");
