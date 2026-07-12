import fs from "node:fs";

const service = fs.readFileSync("src/services/voiceService.ts", "utf8");
const picker = fs.readFileSync("src/components/voice/ScreenSharePicker.tsx", "utf8");
const viewer = fs.readFileSync("src/components/voice/ScreenShareViewer.tsx", "utf8");
const preview = fs.readFileSync("src/components/voice/ScreenSharePreview.tsx", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");

for (const needle of ["sourceLabel?: string", "sourceLabel?.trim().slice(0, 80)", '"Shared screen"']) {
  if (!service.includes(needle)) throw new Error(`Screen share snapshot is missing ${needle}`);
}
if (!picker.includes('screenSharing ? "Stop sharing"') || !picker.includes("screenCaptureService.selectSource") || !picker.includes("result.source.name")) throw new Error("Picker active share controls must use the main-process-approved source");
if (!viewer.includes("screen-share-stop-button") || !viewer.includes("share.sourceLabel")) throw new Error("Screen share preview stop/source state is incomplete");
if (!preview.includes("screen-share-switcher") || !preview.includes("onSelectShare") || !preview.includes("focusedShareId")) throw new Error("Screen share focused multi-sharer switcher is incomplete");
if (!app.includes("startScreenShare(sourceId, preset, sourceLabel)")) throw new Error("App does not forward the safe source label");

console.log("Screen share preview and stop controls smoke passed.");
