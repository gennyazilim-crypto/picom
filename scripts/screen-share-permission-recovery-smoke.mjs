import fs from "node:fs";

const main = fs.readFileSync("electron/main.cts", "utf8");
const service = fs.readFileSync("src/services/screenCaptureService.ts", "utf8");
const picker = fs.readFileSync("src/components/voice/ScreenSharePicker.tsx", "utf8");

for (const needle of ["getMediaAccessStatus", "SCREEN_CAPTURE_PERMISSION_DENIED", "SCREEN_CAPTURE_NO_SOURCES", "UNTRUSTED_SCREEN_CAPTURE_SENDER"]) {
  if (!main.includes(needle)) throw new Error(`Electron capture recovery is missing ${needle}`);
}
for (const needle of ["Privacy & Security > Screen Recording", "Wayland", "protected windows", "SCREEN_CAPTURE_UNAVAILABLE"]) {
  if (!service.includes(needle)) throw new Error(`Screen capture guidance is missing ${needle}`);
}
if (!picker.includes("Try again") || !picker.includes('role="alert"')) throw new Error("Screen source picker retry state is missing");

console.log("Screen share permission recovery smoke passed.");
